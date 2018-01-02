// Read https://buildingrecommenders.wordpress.com/2015/11/18/overview-of-recommender-algorithms-part-2/
// Watch https://www.youtube.com/watch?v=h9gpufJFF-0

import math from 'mathjs';

import {
  getCosineSimilarityRowVector,
  getCosineSimilarityMatrix,
  sortByPrediction,
} from '../common';

export function predictWithCfItemBased(MOVIES_IN_LIST, ratingsGroupedByUser, ratingsGroupedByMovie, userIndex) {
  const { itemUser } = getMatrices(MOVIES_IN_LIST, ratingsGroupedByUser, ratingsGroupedByMovie);
  const { matrix, movieIds } = itemUser;


  // console.log(getCosineSimilarityRowVector([[0, 1], [1, 0], [1, 1], [0, 0]], 0));
  console.log(matrix.length);
  console.log(matrix[0].length);
  console.log(movieIds.length);

  const matrixNormalized = meanNormalizeByRowVector(matrix);
  const userRatingsRowVector = matrixNormalized.map(row => row[userIndex]);

  console.log(userRatingsRowVector.length);

  const predictedRatings = userRatingsRowVector.map((rating, key) => {
    const movieId = movieIds[key];

    let prediction;
    if (rating === 0) {
      prediction = getPredictedRating(
        rating,
        userRatingsRowVector,
        getCosineSimilarityRowVector(matrixNormalized, key)
      );
    } else {
      prediction = rating;
    }

    return { prediction, movieId };
  });

  return sortByPrediction(predictedRatings);
}

function getPredictedRating(rating, ratingsRowVector, cosineSimilarityRowVector) {
  const N = 7;
  const neighborMoviesSelection = cosineSimilarityRowVector
    // keep track of rating and movie index
    .map((similarity, index) => ({ similarity, rating: ratingsRowVector[index] }))
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

// export function predictWithCfUserBased(ratingsGroupedByUser, ratingsGroupedByMovie, userIndex) {
//   let { userItemMatrix, userItemMovieIds } = getMatrices(ratingsGroupedByUser, ratingsGroupedByMovie);
//   // const normalizedMatrix = getNormalizedMatrix(userItemMatrix);

//   const cosineSimilarityRowVector = getCosineSimilarityRowVector(userItemMatrix, userIndex);

//   const ratings = userItemMovieIds.map((movieId, movieKey) => {
//     const coefficients = userItemMatrix.reduce((result, user, userKey) => {
//       let movieRating = user[movieKey];
//       let { weightedSum, similaritySum } = result;

//       weightedSum = weightedSum + movieRating * cosineSimilarityRowVector[userKey];
//       similaritySum = similaritySum + cosineSimilarityRowVector[userKey];

//       return {
//         weightedSum,
//         similaritySum,
//       };
//     }, { weightedSum: 0, similaritySum: 0 });

//     const prediction = coefficients.weightedSum / coefficients.similaritySum;

//     return { movieId, prediction };
//   });

//   return sortByPrediction(ratings);
// }

export function getMatrices(MOVIES_IN_LIST, ratingsGroupedByUser, ratingsGroupedByMovie) {
  // const userItem = Object.keys(ratingsGroupedByUser).reduce((result, userKey) => {
  //   const rowVector = Object.keys(ratingsGroupedByMovie).map(movieKey => {
  //     return getConditionalRating(ratingsGroupedByUser[userKey][movieKey]);
  //   });

  //   result.matrix.push(rowVector);
  //   result.movieIds.push(movieKey);

  //   return result;
  // }, { matrix: [], movieIds: [] });

  const itemUser = MOVIES_IN_LIST.reduce((result, movie, movieKey) => {
    const rowVector = Object.keys(ratingsGroupedByUser).map(userKey => {
      return getConditionalRating(ratingsGroupedByMovie, movieKey, userKey);
    });

    if (!hasRatings(rowVector)) {
      return result;
    }

    result.matrix.push(rowVector);
    result.movieIds.push(movie.id);

    return result;
  }, { matrix: [], movieIds: [] });

  return { itemUser };
}

function hasRatings(rowVector) {
  return rowVector.filter(rating => rating > 0).length;
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