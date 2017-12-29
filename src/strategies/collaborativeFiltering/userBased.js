import math from 'mathjs';

import { getCosineSimilarityRowVector, sortByPrediction } from '../common';

function predictWithCollaborativeFiltering(ratingsGroupedByUser, ratingsGroupedByMovie, MOVIES_IN_LIST, userIndex) {
  let { userItemMatrix, movieIds } = getUserItemMatrix(ratingsGroupedByUser, ratingsGroupedByMovie);
  const normalizedUserItemMatrix = getNormalizedUserItemMatrix(userItemMatrix);

  const userUserCosineSimilarityRowVector = getCosineSimilarityRowVector(normalizedUserItemMatrix, userIndex);

  const ratings = movieIds.map((movieId, movieKey) => {

    const coefficients = normalizedUserItemMatrix.reduce((result, user, userKey) => {
      let movieRating = user[movieKey];
      let { weightedSum, similaritySum } = result;

      weightedSum = weightedSum + movieRating * userUserCosineSimilarityRowVector[userKey];
      similaritySum = similaritySum + userUserCosineSimilarityRowVector[userKey];

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

export function getNormalizedUserItemMatrix(userItemMatrix) {
  return userItemMatrix.map(user => {
    const mean = math.mean(user);
    return user.map(rating => {
      return rating > 0 ? rating - mean : 0;
    });
  });
}

export function getUserItemMatrix(ratingsGroupedByUser, ratingsGroupedByMovie) {
  const userItemMatrix = Object.keys(ratingsGroupedByUser).map(userKey => {
    return Object.keys(ratingsGroupedByMovie).map(movieKey => {
      return getConditionalRating(ratingsGroupedByUser[userKey][movieKey]);
    });
  });

  // Keep track for later reference
  const movieIds = Object.keys(ratingsGroupedByMovie).reduce((result, movieId) => {
    result.push(movieId)
    return result;
  }, []);

  return { userItemMatrix, movieIds };
}

function getConditionalRating(value) {
  return value ? value.rating : 0;
}

export default predictWithCollaborativeFiltering;
