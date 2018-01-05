// Read https://buildingrecommenders.wordpress.com/2015/11/18/overview-of-recommender-algorithms-part-2/
// Watch https://www.youtube.com/watch?v=h9gpufJFF-0

import math from 'mathjs';

import {
  getCosineSimilarityRowVector,
  getCosineSimilarityMatrix,
  sortByPrediction,
} from '../common';

export function predictWithCfItemBased(ratingsGroupedByUser, ratingsGroupedByMovie, userId) {
  const { itemUser } = getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie);
  const { matrix, movieIds } = itemUser;

  const matrixNormalized = meanNormalizeByRowVector(matrix);
  const userRatingsRowVector = Object.keys(ratingsGroupedByMovie).map(movieId => {
    const movieRating = ratingsGroupedByUser[userId][movieId];
    return movieRating ? movieRating.rating : 0;
  });

  const predictedRatings = userRatingsRowVector.map((rating, key) => {
    if (key % 2500 === 0) {
      console.log(`${key} out of ${userRatingsRowVector.length} predicted...`);
    }

    const movieId = movieIds[key];

    let score = rating;

    if (rating === 0 && !hasRatings(matrixNormalized[key])) {
      score = 0;
    }

    if (rating === 0 && hasRatings(matrixNormalized[key])) {
      let cosineSimilarityRowVector = getCosineSimilarityRowVector(matrixNormalized, key);

      score = getPredictedRating(
        rating,
        userRatingsRowVector,
        cosineSimilarityRowVector
      );
    }

    return { prediction: score, movieId };
  });

  return sortByPrediction(predictedRatings);
}

function getPredictedRating(rating, ratingsRowVector, cosineSimilarityRowVector) {
  const N = 7;
  const neighborMoviesSelection = cosineSimilarityRowVector
    // keep track of rating and movie index
    .map((similarity, index) => ({ similarity: isNaN(similarity) ? 0 : similarity, rating: ratingsRowVector[index] }))
    // only neighbors with a rating
    .filter(value => value.rating !== 0)
    // most similar neighbors on top
    .sort((a, b) => b.similarity - a.similarity)
    // N neighbors
    .slice(0, N);

  const numerator = neighborMoviesSelection.reduce((result, value, key) => {
    return result + value.similarity * value.rating;
  }, 0);

  const denominator = neighborMoviesSelection.reduce((result, value) => {
    return result + math.pow(value.similarity, 2);
  }, 0);

  return numerator / math.sqrt(denominator);
}

function meanNormalizeByRowVector(matrix) {
  return matrix.map((rowVector) => {
    const mean = getMean(rowVector);
    return rowVector.map(cell => {
      return cell !== 0 ? cell - mean : cell;
    });
  });
}

function getMean(rowVector) {
  const valuesWithoutZeroes = rowVector.filter(cell => cell !== 0);
  return valuesWithoutZeroes.length ? math.mean(valuesWithoutZeroes) : 0;
}

export function getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie) {
  const itemUser = Object.keys(ratingsGroupedByMovie).reduce((result, movieId) => {
    const rowVector = Object.keys(ratingsGroupedByUser).map(userId => {
      return getConditionalRating(ratingsGroupedByMovie, movieId, userId);
    });

    if (!hasRatings(rowVector)) {
      console.log(ratingsGroupedByMovie[movieId]);
    }

    result.matrix.push(rowVector);
    result.movieIds.push(movieId);

    return result;
  }, { matrix: [], movieIds: [] });

  return { itemUser };
}

function hasRatings(rowVector) {
  return rowVector.filter(rating => rating !== 0).length > 0;
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