import { getCosineSimilarityRowVector, sortByPrediction } from './common';

function predictWithContentBased(X, MOVIES_IN_LIST, title) {
  const { index } = getMovieIndexByTitle(MOVIES_IN_LIST, title);

  // Compute similarities based on input movie
  const cosineSimilarityRowVector = getCosineSimilarityRowVector(X, index);

  // Enrich the vector to convey all information
  // Use references from before which we kept track of
  const contentBasedRecommendation = cosineSimilarityRowVector
    .map((value, key) => ({
      prediction: value,
      movieId: MOVIES_IN_LIST[key].id,
    }));

  return sortByPrediction(contentBasedRecommendation);
}

export function getMovieIndexByTitle(MOVIES_IN_LIST, query) {
  const index = MOVIES_IN_LIST.map(movie => movie.title).indexOf(query);

  if (!index) {
    throw new Error('Movie not found');
  }

  const { title, id } = MOVIES_IN_LIST[index];
  return { index, title, id };
}

export default predictWithContentBased;