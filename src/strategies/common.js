import similarity from 'compute-cosine-similarity';

export function sortByPrediction(recommendation) {
  return recommendation.sort((a, b) => b.prediction - a.prediction);
}

export function getCosineSimilarityMatrix(matrix) {
  return matrix.map((rowAbsolute, i) => {
    return matrix.map((rowRelative, j) => {
      return similarity(matrix[i], matrix[j]);
    });
  });
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