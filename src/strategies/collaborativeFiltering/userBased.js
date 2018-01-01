import math from 'mathjs';

import {
  getCosineSimilarityRowVector,
  getCosineSimilarityMatrix,
  sortByPrediction,
} from '../common';

export function predictWithCfItemBased(ratingsGroupedByUser, ratingsGroupedByMovie, userIndex) {
  let { userItemMatrix, itemUserMatrix, itemUserMovieIds } = getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie);

  // console.log(itemUserMovieIds.length);
  // console.log(ratingsByUser.length);
  // console.log(cosineSimilarityMatrix.length);
  // console.log(cosineSimilarityMatrix[0].length);

  const userRatingsVector = userItemMatrix[userIndex];
  const cosineSimilarityMatrix = getCosineSimilarityMatrix(itemUserMatrix);

  const ratings = itemUserMatrix.map((otherUserRatings, movieKeyAbsolute) => {
    const coefficients = otherUserRatings.reduce((result, rating, movieKeyRelative) => {

      let { weightedSum, similaritySum } = result;

      // console.log(cosineSimilarityMatrix[movieKeyAbsolute][movieKeyRelative], rating);

      weightedSum = weightedSum + rating * cosineSimilarityMatrix[movieKeyAbsolute][movieKeyRelative];
      similaritySum = similaritySum + cosineSimilarityMatrix[movieKeyAbsolute][movieKeyRelative];

      return {
        weightedSum,
        similaritySum,
        movieId: itemUserMovieIds[movieKeyAbsolute],
      };
    }, { weightedSum: 0, similaritySum: 0 });

    console.log(coefficients);

    const { weightedSum, similaritySum, movieId } = coefficients;
    const prediction = weightedSum / similaritySum;

    return { movieId, prediction };
  });
  // console.log(ratings);
  return sortByPrediction(ratings);
}

export function predictWithCfUserBased(ratingsGroupedByUser, ratingsGroupedByMovie, userIndex) {
  let { userItemMatrix, userItemMovieIds } = getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie);
  // const normalizedMatrix = getNormalizedMatrix(userItemMatrix);

  const cosineSimilarityRowVector = getCosineSimilarityRowVector(userItemMatrix, userIndex);

  const ratings = userItemMovieIds.map((movieId, movieKey) => {
    const coefficients = userItemMatrix.reduce((result, user, userKey) => {
      let movieRating = user[movieKey];
      let { weightedSum, similaritySum } = result;

      weightedSum = weightedSum + movieRating * cosineSimilarityRowVector[userKey];
      similaritySum = similaritySum + cosineSimilarityRowVector[userKey];

      return {
        weightedSum,
        similaritySum,
      };
    }, { weightedSum: 0, similaritySum: 0 });

    const prediction = coefficients.weightedSum / coefficients.similaritySum;

    return { movieId, prediction };
  });

  return sortByPrediction(ratings);
}

export function getNormalizedMatrix(matrix) {
  return matrix.map(row => {
    const mean = math.mean(row);
    return row.map(rating => {
      return rating > 0 ? rating - mean : 0;
    });
  });
}

export function getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie) {
  const userItemMatrix = Object.keys(ratingsGroupedByUser).map(userKey => {
    return Object.keys(ratingsGroupedByMovie).map(movieKey => {
      return getConditionalRating(ratingsGroupedByUser[userKey][movieKey]);
    });
  });

  const userItemMovieIds = Object.keys(ratingsGroupedByUser).map(userKey => {
    return Object.keys(ratingsGroupedByMovie).map(movieKey => {
      return movieKey;
    });
  });

  const itemUserMatrix = Object.keys(ratingsGroupedByMovie).map(movieKey => {
    return Object.keys(ratingsGroupedByUser).map(userKey => {
      return getConditionalRating(ratingsGroupedByMovie[movieKey][userKey]);
    });
  });

  const itemUserMovieIds = Object.keys(ratingsGroupedByMovie).map(movieKey => {
    return movieKey;
  });

  return { userItemMatrix, itemUserMatrix, userItemMovieIds, itemUserMovieIds };
}

function getConditionalRating(value) {
  return value ? value.rating : 0;
}