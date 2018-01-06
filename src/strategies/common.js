import similarity from 'compute-cosine-similarity';

export function sortByScore(recommendation) {
  return recommendation.sort((a, b) => b.score - a.score);
}

// X x 1 row vector based on similarities of movies
// 1 equals similar, -1 equals not similar, 0 equals orthogonal
// Whole matrix is too computational expensive for 45.000 movies
// https://en.wikipedia.org/wiki/Cosine_similarity
export function getCosineSimilarityRowVector(matrix, index) {
  return matrix.map((rowRelative, i) => {
    return similarity(matrix[index], matrix[i]);
  });
}

export function getMovieIndexByTitle(MOVIES_IN_LIST, query) {
  const index = MOVIES_IN_LIST.map(movie => movie.title).indexOf(query);

  if (!index) {
    throw new Error('Movie not found');
  }

  const { title, id } = MOVIES_IN_LIST[index];
  return { index, title, id };
}