import { getCosineSimilarityRowVector, sortByPrediction } from './common';

function predictWithCollaborativeFiltering(ratingsGroupedByUser, ratingsGroupedByMovie, userIndex) {
  const userItemMatrix = getUserItemMatrix(ratingsGroupedByUser, ratingsGroupedByMovie);

  const collaborativeFilteringByUser = getCollaborativeFilteringByUser(userItemMatrix, userIndex);

  const moviesIdsRatedByUser = Object.keys(ratingsGroupedByUser[userIndex]);

  const moviesIdsRatedBySimilarUsers = collaborativeFilteringByUser.reduce((result, value, key) => {
    const potentialNewMovieIds = Object.keys(ratingsGroupedByUser[value.userId]);
    const newMovieIds = potentialNewMovieIds.filter(movieId => !result.includes(movieId));
    return [ ...result, ...newMovieIds ];
  }, []);

  // const unseenMoviesIds = moviesIdsRatedBySimilarUsers.filter(movieId => !moviesIdsRatedByUser.includes(movieId))

  const collaborativeFilteringBasedRecommendation = moviesIdsRatedBySimilarUsers.reduce((result, movieId) => {
    const weightedSum = collaborativeFilteringByUser.reduce((result, value) => {

      const { userId, similarity } = value;
      const ratingBySimilarUser = ratingsGroupedByUser[userId][movieId];
      const conditionalRating = ratingBySimilarUser ? ratingBySimilarUser.rating : 0;
      return result + (conditionalRating * similarity);

    }, 0);

    result.push({ movieId, prediction: weightedSum / collaborativeFilteringByUser.length });

    return result;
  }, []);

  return sortByPrediction(collaborativeFilteringBasedRecommendation);
}

export function getCollaborativeFilteringByUser(userItemMatrix, userIndex) {
  const cosineSimilarityRowVector = getCosineSimilarityRowVector(userItemMatrix, userIndex); // TODO other way around for item item

  return cosineSimilarityRowVector
    .map((value, key) => ({ similarity: value, userId: key }))
    .filter(a => a.similarity > 0)
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
