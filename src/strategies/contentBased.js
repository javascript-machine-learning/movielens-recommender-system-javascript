import { getCosineSimilarityRowVector, sortByPrediction } from './common';

function predictWithContentBased(X, MOVIES_IN_LIST, title) {
  const movieIndex = getMovieByTitle(MOVIES_IN_LIST, title);

  // Compute similarities based on input movie
  const cosineSimilarityRowVector = getCosineSimilarityRowVector(X, movieIndex);

  // Enrich the vector to convey all information
  // Use references from before which we kept track of
  const contentBasedRecommendation = cosineSimilarityRowVector
    .map((value, key) => ({
      prediction: value,
      movieId: MOVIES_IN_LIST[key].id,
    }));

  return sortByPrediction(contentBasedRecommendation);
}

export function getMovieByTitle(MOVIES_IN_LIST, title) {
  return MOVIES_IN_LIST.map(movie => movie.title).indexOf(title);
}

export default predictWithContentBased;