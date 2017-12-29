import math from 'mathjs';

import { getCosineSimilarityRowVector, sortByPrediction } from './common';

function predictWithCollaborativeFiltering(ratingsGroupedByUser, ratingsGroupedByMovie, userIndex) {

  const moviesIdsRatedByUser = Object.keys(ratingsGroupedByUser[userIndex]);
  const moviesIdsRatedByUsers = Object.keys(ratingsGroupedByMovie);

  const userItemMatrix = getUserItemMatrix(ratingsGroupedByUser, ratingsGroupedByMovie);
  const collaborativeFilteringByUser = getCollaborativeFilteringByUser(userItemMatrix, userIndex);

  const unseenMoviesIds = moviesIdsRatedByUsers.filter(movieId => !moviesIdsRatedByUser.includes(movieId))

  const collaborativeFilteringBasedRecommendation = unseenMoviesIds.reduce((result, movieId) => {
    const weightedSum = collaborativeFilteringByUser.reduce((result, value) => {

      const { userId, similarity } = value;
      const ratingBySimilarUser = ratingsGroupedByUser[userId][movieId];
      const conditionalRating = ratingBySimilarUser ? ratingBySimilarUser.rating : 0;
      return result + (conditionalRating * similarity);

    }, 0);

    const prediction = weightedSum / collaborativeFilteringByUser.length;

    result.push({ movieId, prediction });

    return result;
  }, []);

  return sortByPrediction(collaborativeFilteringBasedRecommendation);
}

export function getCollaborativeFilteringByUser(userItemMatrix, userIndex) {
  const cosineSimilarityRowVector = getCosineSimilarityRowVector(userItemMatrix, userIndex);

  return cosineSimilarityRowVector
    .map((value, key) => ({ similarity: value, userId: key }))
    .sort((a, b) => b.similarity - a.similarity);
}

export function getUserItemMatrix(ratingsGroupedByUser, ratingsGroupedByMovie) {
  return Object.keys(ratingsGroupedByUser).map(userKey => {
    return Object.keys(ratingsGroupedByMovie).map((movieKey) => {
      const value = ratingsGroupedByUser[userKey][movieKey];
      return value ? value.rating : 0;
    });
  });
}

export default predictWithCollaborativeFiltering;
