// Read https://buildingrecommenders.wordpress.com/2015/11/18/overview-of-recommender-algorithms-part-2/
// Watch https://www.youtube.com/watch?v=h9gpufJFF-0
// Read https://datascience.stackexchange.com/questions/2598/item-based-and-user-based-recommendation-difference-in-mahout

import math from 'mathjs';

import {
  getCosineSimilarityRowVector,
  sortByScore,
} from './common';

export function predictWithCfUserBased(ratingsGroupedByUser, ratingsGroupedByMovie, userId) {
  const { userItem } = getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie, userId);
  const { matrix, movieIds, userIndex } = userItem;

  const matrixNormalized = meanNormalizeByRowVector(matrix);
  const userRatingsRowVector = matrixNormalized[userIndex];

  const cosineSimilarityRowVector = getCosineSimilarityRowVector(matrixNormalized, userIndex);

  const predictedRatings = userRatingsRowVector.map((rating, movieIndex) => {
    const movieId = movieIds[movieIndex];

    const movieRatingsRowVector = getMovieRatingsRowVector(matrixNormalized, movieIndex);

    let score;
    if (rating === 0) {
      score = getPredictedRating(movieRatingsRowVector, cosineSimilarityRowVector);
    } else {
      score = rating
    }

    return { score, movieId };
  });

  return sortByScore(predictedRatings);
}

export function predictWithCfItemBased(ratingsGroupedByUser, ratingsGroupedByMovie, userId) {
  const { itemUser } = getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie, userId);
  const { matrix, movieIds, userIndex } = itemUser;

  const matrixNormalized = meanNormalizeByRowVector(matrix);
  const userRatingsRowVector = getUserRatingsRowVector(matrixNormalized, userIndex);

  const predictedRatings = userRatingsRowVector.map((rating, movieIndex) => {
    const movieId = movieIds[movieIndex];

    const cosineSimilarityRowVector = getCosineSimilarityRowVector(matrixNormalized, movieIndex);

    let score;
    if (rating === 0) {
      score = getPredictedRating(
        userRatingsRowVector,
        cosineSimilarityRowVector
      );
    } else {
      score = rating;
    }

    return { score, movieId };
  });

  return sortByScore(predictedRatings);
}

function getPredictedRating(ratingsRowVector, cosineSimilarityRowVector) {
  const N = 5;
  const neighborSelection = cosineSimilarityRowVector
    // keep track of rating and similarity
    .map((similarity, index) => ({ similarity, rating: ratingsRowVector[index] }))
    // only neighbors with a rating
    .filter(value => value.rating !== 0)
    // most similar neighbors on top
    .sort((a, b) => b.similarity - a.similarity)
    // N neighbors
    .slice(0, N);

  const numerator = neighborSelection.reduce((result, value) => {
    return result + value.similarity * value.rating;
  }, 0);

  const denominator = neighborSelection.reduce((result, value) => {
    return result + math.pow(value.similarity, 2);
  }, 0);

  return numerator / math.sqrt(denominator);
}

function getUserRatingsRowVector(itemBasedMatrix, userIndex) {
  return itemBasedMatrix.map(itemRatings => {
    return itemRatings[userIndex];
  });
}

function getMovieRatingsRowVector(userBasedMatrix, movieIndex) {
  return userBasedMatrix.map(userRatings => {
    return userRatings[movieIndex];
  });
}

function meanNormalizeByRowVector(matrix) {
  return matrix.map((rowVector) => {
    return rowVector.map(cell => {
      return cell !== 0 ? cell - getMean(rowVector) : cell;
    });
  });
}

function getMean(rowVector) {
  const valuesWithoutZeroes = rowVector.filter(cell => cell !== 0);
  return valuesWithoutZeroes.length ? math.mean(valuesWithoutZeroes) : 0;
}

export function getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie, uId) {
  const itemUser = Object.keys(ratingsGroupedByMovie).reduce((result, movieId) => {
    const rowVector = Object.keys(ratingsGroupedByUser).map((userId, userIndex) => {

      if (userId == uId) {
        result.userIndex = userIndex;
      }

      return getConditionalRating(ratingsGroupedByMovie, movieId, userId);
    });

    result.matrix.push(rowVector);
    result.movieIds.push(movieId);

    return result;
  }, { matrix: [], movieIds: [], userIndex: null });

  const userItem = Object.keys(ratingsGroupedByUser).reduce((result, userId, userIndex) => {
    const rowVector = Object.keys(ratingsGroupedByMovie).map(movieId => {
      return getConditionalRating(ratingsGroupedByUser, userId, movieId);
    });

    result.matrix.push(rowVector);

    if (userId == uId) {
      result.userIndex = userIndex;
    }

    return result;
  }, { matrix: [], movieIds: Object.keys(ratingsGroupedByMovie), userIndex: null });

  return { itemUser, userItem };
}

function getConditionalRating(value, primaryKey, secondaryKey) {
  if (!value[primaryKey]) {
    return 0;
  }

  if (!value[primaryKey][secondaryKey]) {
    return 0;
  }

  return value[primaryKey][secondaryKey].rating;
}