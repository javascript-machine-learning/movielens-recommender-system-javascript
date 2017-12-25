// https://www.kaggle.com/rounakbanik/the-movies-dataset/data
// Exercise: Use credits data with crew and cast too
// Exercise: Make feature more weighted based on popularity or actors

import fs from 'fs';
import csv from 'fast-csv';
import natural from 'natural';
import math from 'mathjs';
import similarity from 'compute-cosine-similarity';
import synchronizedShuffle from 'synchronized-array-shuffle';

natural.PorterStemmer.attach();

let MOVIES_META_DATA = {};
let MOVIES_KEYWORDS = {};
let RATINGS = [];

let moviesMetaDataPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/movies_metadata.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromMetaDataFile)
    .on('end', () => resolve(MOVIES_META_DATA)));

let moviesKeywordsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/keywords.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromKeywordsFile)
    .on('end', () => resolve(MOVIES_KEYWORDS)));

let ratingsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/ratings_small.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromRatingsFile)
    .on('end', () => resolve(RATINGS)));

function fromMetaDataFile(row) {
  MOVIES_META_DATA[row.id] = {
    id: row.id,
    adult: row.adult,
    budget: row.budget,
    genres: softEval(row.genres, []),
    homepage: row.homepage, // perhaps it says something if there is a homepage (0:'', 1:'http://...')
    language: row.original_language, // people might be more inot foreign movies (0:eng, 1:other)
    title: row.original_title, // no feature, but later in movie lookup table
    overview: row.overview, // preprocess: tokenize, stemmer (dictionary)
    popularity: row.popularity,
    studio: softEval(row.production_companies, []), // people might have their favorite film studios (dictionary)
    release: row.release_date, // (0: 1964, 1:2018)
    revenue: row.revenue,
    runtime: row.runtime,
    voteAverage: row.vote_average,
    voteCount: row.vote_count,
  };
}

function fromKeywordsFile(row) {
  MOVIES_KEYWORDS[row.id] = {
    keywords: softEval(row.keywords, []), // (dictionary)
  };
}

function fromRatingsFile(row) {
  RATINGS.push(row);
}

Promise.all([
  moviesMetaDataPromise,
  moviesKeywordsPromise,
  ratingsPromise,
]).then(init);

function init([ moviesMetaData, moviesKeywords, ratings ]) {
  /* ------------ */
  //  Preparation //
  /* -------------*/

  // Binary Ratings Matrix (computational expensive)
  // Only group ratings by user
  let ratingsGroupedByUser = getRatingsGroupedByUser(ratings);

  // Pre-processing movies for unified data structure
  // E.g. get overview property into same shape as studio property
  let movies = zip(moviesMetaData, moviesKeywords);
  movies = withTokenizedAndStemmed(movies, 'overview');
  movies = fromArrayToMap(movies, 'overview');

  // Remove unrated movies, otherwise the data set is too big
  // let ratingsGroupedByMovie = getRatingsGroupedByMovie(ratings);
  // movies = withoutUnratedMovies(movies, ratingsGroupedByMovie);

  // Preparing dictionaries for feature extraction
  let genresDictionary = toDictionary(movies, 'genres');
  let studioDictionary = toDictionary(movies, 'studio');
  let keywordsDictionary = toDictionary(movies, 'keywords');
  let overviewDictionary = toDictionary(movies, 'overview');

  // Customize the threshold to your own needs
  // Depending on threshold you get a different size of a feature vector for a movie
  // The following case attempts to keep feature vector small for computational efficiency
  genresDictionary = filterByThreshold(genresDictionary, 1);
  studioDictionary = filterByThreshold(studioDictionary, 100);
  keywordsDictionary = filterByThreshold(keywordsDictionary, 100);
  overviewDictionary = filterByThreshold(overviewDictionary, 750);

  const DICTIONARIES = {
    genresDictionary,
    studioDictionary,
    keywordsDictionary,
    overviewDictionary,
  };

  // Feature Extraction:
  // Map different types to numerical values (e.g. adult to 0 or 1)
  // Map dictionaries to partial feature vectors
  let X = movies.map(toFeaturizedMovies(DICTIONARIES));

  // Extract a couple of valuable coefficients
  // Can be used in a later stage (e.g. feature scaling)
  const { means, ranges } = getCoefficients(X);

  // Synthesize Features:
  // Missing features (such as budget, release, revenue)
  // can be synthesized with the mean of the features
  X = synthesizeFeatures(X, means, [0, 1, 2, 3, 4, 5, 6]);

  // Feature Scaling:
  // Normalize features based on mean and range vectors
  X = scaleFeatures(X, means, ranges);

  /* ----------- */
  //  Prediction //
  /* ------------*/

  // const contentBasedRecommendation = getContentBasedRecommendationByUser(X, movies, ratingsGroupedByUser['1']);

  const { movie, index } = getMovieByTitle(movies, 'Batman Begins');
  const cosineSimilarityRowVector = getCosineSimilarityRowVector(X, index);
  const similarityBasedRecommendation = getSimilarityBasedRecommendation(cosineSimilarityRowVector, 10);

  console.log(movie.title);
  console.log(similarityBasedRecommendation.map(result => movies[result.key].title));
}

function getMovieByTitle(movies, title) {
  const index = movies.map(movie => movie.title).indexOf(title);
  return { movie: movies[index], index };
}

// Ascending sorted recommendation
function getSimilarityBasedRecommendation(cosineSimilarityRowVector, count) {
  return cosineSimilarityRowVector
    .map((value, key) => ({ value, key }))
    .sort((a, b) => b.value - a.value)
    // 0th is input movie because similarity is 1
    .slice(1, count + 1);
}

// X x 1 row vector based on similarities of movies
// 1 means similar, -1 means not similar, 0 means orthogonal
// Matrix is too computational expensive for 45.000 movies
// https://en.wikipedia.org/wiki/Cosine_similarity
function getCosineSimilarityRowVector(X, index) {
  return X[index].map((row, i) => {
    return similarity(X[index], X[i]);
  });
}

function getContentBasedRecommendationByUser(X, movies, ratings) {
  // Add intercept term
  const ones = Array(X.length).fill().map((v, i) => [1]);
  X = math.concat(ones, X);

  const init = {
    training: {
      X: [],
      y: [],
    },
    // Even though it is not really a test set
    // because it has no labels
    test: {
      X: [],
      references: [],
    }
  };

  const { training, test } = movies.reduce((result, value, key) => {
    if (ratings[value.id]) {
      result.training.X.push(X[key]);
      result.training.y.push([ratings[value.id].rating]); // ??
    } else {
      result.test.X.push(X[key]);
      // Keep a reference to map the training matrix to the real movies later
      result.test.references.push(value);
    }

    return result;
  }, init);

  let theta = Array(training.X[0].length).fill().map((v, i) => [0]);
  theta = gradientDescent(
    training.X,
    training.y,
    theta,
    0.03,
    750
  );

  let predictedRatings = getPredictedRatings(theta, test.X);

  // Format the vector to convey the referenced movie id
  predictedRatings = test.X.map((v, key) => ({
    rating: predictedRatings[key],
    movie: test.references[key],
  }));

  return predictedRatings.sort((a, b) => b.rating - a.rating);
}

function gradientDescent(X, y, theta, ALPHA, ITERATIONS) {
  const m = y.length;

  for (let i = 0; i < ITERATIONS; i++) {
    theta = math.eval(`theta - ALPHA / m * ((X * theta - y)' * X)'`, {
      theta,
      ALPHA,
      m,
      X,
      y,
    });
  }

  const cost = computeCost(X, y, theta);
  console.log(cost);

  return theta;
}

function getPredictedRatings(theta, X) {
  return math.eval(`X * theta`, {
    theta,
    X,
  })
}

function computeCost(X, y, theta) {
  let m = y.length;

  let predictions = math.eval('X * theta', {
    X,
    theta,
  });

  let sqrErrors = math.eval('(predictions - y).^2', {
    predictions,
    y,
  });

  let J = math.eval(`1 / (2 * m) * sum(sqrErrors)`, {
    m,
    sqrErrors,
  });

  return J;
}

// function withoutUnratedMovies(movies, ratingsGroupedByMovie) {
//   return movies.filter(movie => ratingsGroupedByMovie[movie.id]);
// }

function getRatingsGroupedByMovie(ratings) {
  return ratings.reduce((result, value) => {
    const { userId, movieId, rating, timestamp } = value;

    if (!result[movieId]) {
      result[movieId] = {};
    }

    result[movieId][userId] = { rating: Number(rating), timestamp };

    return result;
  }, {});
}

function getRatingsGroupedByUser(ratings) {
  return ratings.reduce((result, value) => {
    const { userId, movieId, rating, timestamp } = value;

    if (!result[userId]) {
      result[userId] = {};
    }

    result[userId][movieId] = { rating: Number(rating), timestamp };

    return result;
  }, {});
}

// Too expensive

// function getBinaryRatingsMatrix(movies, ratingsGroupedByUser) {
//   return movies.map((movie) => {
//     return Object.keys(ratingsGroupedByUser).map((ratingKey) => {
//       const movieIds = ratingsGroupedByUser[ratingKey].map(rating => rating.movieId);
//       return movieIds.includes(movie.id) ? 1 : 0;
//     });
//   });
// }

function scaleFeatures(X, means, ranges) {
  return X.map((row) => {
    return row.map((feature, key) => {
      return (feature - means[key]) / ranges[key];
    });
  });
};

function synthesizeFeatures(X, means, featureIndexes) {
  return X.map((row) => {
    return row.map((feature, key) => {
      if (featureIndexes.includes(key) && feature === 'undefined') {
        return means[key];
      } else {
        return feature;
      }
    });
  });
}

function getCoefficients(X) {
  const M = X.length;

  const initC = {
    sums: [],
    mins: [],
    maxs: [],
  };

  const helperC = X.reduce((result, row) => {
    if (row.includes('undefined')) {
      return result;
    }

    return {
      sums: row.map((feature, key) => {
        if (result.sums[key]) {
          return result.sums[key] + feature;
        } else {
          return feature;
        }
      }),
      mins: row.map((feature, key) => {
        if (result.mins[key] === 'undefined') {
          return result.mins[key];
        }

        if (result.mins[key] <= feature) {
          return result.mins[key];
        } else {
          return feature;
        }
      }),
      maxs: row.map((feature, key) => {
        if (result.maxs[key] === 'undefined') {
          return result.maxs[key];
        }

        if (result.maxs[key] >= feature) {
          return result.maxs[key];
        } else {
          return feature;
        }
      }),
    };
  }, initC);

  const means = helperC.sums.map(value => value / M);
  const ranges =  helperC.mins.map((value, key) => helperC.maxs[key] - value);

  return { ranges, means };
}

function toFeaturizedMovies(dictionaries) {
  return function toFeatureVector(movie) {
    const featureVector = [];

    featureVector.push(toFeaturizedNumber(movie, 'budget'));
    featureVector.push(toFeaturizedNumber(movie, 'popularity'));
    featureVector.push(toFeaturizedNumber(movie, 'revenue'));
    featureVector.push(toFeaturizedNumber(movie, 'runtime'));
    featureVector.push(toFeaturizedNumber(movie, 'voteAverage'));
    featureVector.push(toFeaturizedNumber(movie, 'voteCount'));
    featureVector.push(toFeaturizedRelease(movie));

    featureVector.push(toFeaturizedAdult(movie));
    featureVector.push(toFeaturizedHomepage(movie));
    featureVector.push(toFeaturizedLanguage(movie));

    featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.genresDictionary, 'genres'));
    featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.overviewDictionary, 'overview'));
    featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.studioDictionary, 'studio'));
    featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.keywordsDictionary, 'keywords'));

    return featureVector;
  }
}

function toFeaturizedRelease(movie) {
  return movie.release ? Number((movie.release).slice(0, 4)) : 'undefined';
}

function toFeaturizedAdult(movie) {
  return movie.adult === 'False' ? 0 : 1;
}

function toFeaturizedHomepage(movie) {
  return movie.homepage ? 0 : 1;
}

function toFeaturizedLanguage(movie) {
  return movie.language === 'en' ? 1 : 0;
}

function toFeaturizedFromDictionary(movie, dictionary, property) {
  // Fallback, because not all movies have associated keywords
  const propertyIds = (movie[property] || []).map(value => value.id);
  const isIncluded = (value) => propertyIds.includes(value.id) ? 1 : 0;
  return dictionary.map(isIncluded);
}

function toFeaturizedNumber(movie, property) {
  const number = Number(movie[property]);

  // Fallback for NaN
  if (number > 0 || number === 0) {
    return number;
  } else {
    return 'undefined';
  }
}

// Refactored in favor of generic function

// function toFeaturizedGenres(movie, genresDictionary) {
//   const movieGenreIds = movie.genres.map(genre => genre.id);
//   const isGenre = (genre) => movieGenreIds.includes(genre.id) ? 1 : 0;
//   return genresDictionary.map(isGenre);
// }

// function getFeatureScalingCoefficients(movies, 'budget') {
//   const { range, mean } = movies.reduce((result, value, property) => {

//   }, {});

//   return { range, mean };
// }

// function toFeaturizedLanguageProperty(movie) {
//   return 0;
// }

function fromArrayToMap(array, property) {
  return array.map((value) => {
    const transformed = value[property].map((value) => ({
      id: value,
      name: value,
    }));

    return { ...value, [property]: transformed };
  });
}

function withTokenizedAndStemmed(array, property) {
  return array.map((value) => ({
    ...value,
    [property]: value[property].tokenizeAndStem(),
  }));
}

function filterByThreshold(dictionary, threshold) {
  return Object.keys(dictionary)
    .filter(key => dictionary[key].count > threshold)
    .map(key => dictionary[key]);
}

function toDictionary(array, property) {
  const dictionary = {};

  array.forEach((value) => {
    // fallback for null value after refactoring
    (value[property] || []).forEach((innerValue) => {
      if (!dictionary[innerValue.id]) {
        dictionary[innerValue.id] = {
          ...innerValue,
          count: 1,
        };
      } else {
        dictionary[innerValue.id] = {
          ...dictionary[innerValue.id],
          count: dictionary[innerValue.id].count + 1,
        }
      }
    });
  });

  return dictionary;
}

// Refactored in favor of toDictionary

// function toGenresDictionary(movies) {
//   const genresDictionary = {};

//   movies.forEach((movie) => {
//     movie.genres.forEach((genre) => {
//       if (!genresDictionary[genre.id]) {
//         genresDictionary[genre.id] = {
//           name: genre.name,
//           count: 1,
//         };
//       } else {
//         genresDictionary[genre.id] = {
//           name: genre.name,
//           count: genresDictionary[genre.id].count + 1,
//         }
//       }
//     });
//   });

//   return genresDictionary;
// }

function zip(movies, keywords) {
  return Object.keys(movies).map(mId => ({
    ...movies[mId],
    ...keywords[mId],
  }));
}

function softEval(string, escape) {
  if (!string) {
    return escape;
  }

  try {
    return eval(string);
  } catch (e) {
    return escape;
  }
}