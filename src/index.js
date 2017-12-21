// https://www.kaggle.com/rounakbanik/the-movies-dataset/data

import fs from 'fs';
import csv from 'fast-csv';
import natural from 'natural';
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

  // Pre-processing movies for unified data structure
  // E.g. get overview property into same shape as studio property
  let movies = zip(moviesMetaData, moviesKeywords);
  movies = withTokenizedAndStemmed(movies, 'overview');
  movies = fromArrayToMap(movies, 'overview');

  // Preparing dictionaries for Feature Extraction
  let genresDictionary = toDictionary(movies, 'genres');
  let studioDictionary = toDictionary(movies, 'studio');
  let keywordsDictionary = toDictionary(movies, 'keywords');
  let overviewDictionary = toDictionary(movies, 'overview');

  // Customize the threshold to your own needs
  // Depending on threshold you get a different size of a feature vector for a movie
  // The following case attempts to keep feature vector small for computational efficiency
  genresDictionary = filterByThreshold(genresDictionary, 1);
  studioDictionary = filterByThreshold(studioDictionary, 50);
  keywordsDictionary = filterByThreshold(keywordsDictionary, 100);
  overviewDictionary = filterByThreshold(overviewDictionary, 750);

  const DICTIONARIES = {
    genresDictionary,
    studioDictionary,
    keywordsDictionary,
    overviewDictionary,
  };

  // Feature Extraction
  let X = movies.map(toFeaturizedMovies(DICTIONARIES));

  const {
    means,
    // ranges,
  } = getCoefficients(X);

  // Synthesize missing features in movies
  X = synthesizeFeatures(X, means);

  // Feature Scaling



  console.log(movies[45331]);
  console.log(X[45331]);
}


function synthesizeFeatures(X, means) {
  return X.map(movie => {
    let [
      budget,
      popularity,
      revenue,
      runtime,
      voteAverage,
      voteCount,
      release,
      ...otherFeatures
    ] = movie;

    return [
      budget ? budget : means.budgetMean,
      popularity ? popularity : means.popularityMean,
      revenue ? revenue : means.revenueMean,
      runtime ? runtime : means.runtimeMean,
      voteAverage ? voteAverage : means.voteAverageMean,
      voteCount ? voteCount : means.voteCountMean,
      release ? release : means.releaseMean,
      ...otherFeatures,
    ];
  });
}

function getCoefficients(X) {
  const M = X.length;

  const initCoefficients = {
    sums: {
      budget: 0,
      popularity: 0,
      revenue: 0,
      runtime: 0,
      voteAverage: 0,
      voteCount: 0,
      release: 0,
    },
    mins: {
      budget: 0,
      popularity: 0,
      revenue: 0,
      runtime: 0,
      voteAverage: 0,
      voteCount: 0,
      release: 0,
    },
    maxs: {
      budget: 0,
      popularity: 0,
      revenue: 0,
      runtime: 0,
      voteAverage: 0,
      voteCount: 0,
      release: 0,
    },
  };

  const helperCoefficients = X.reduce((result, value, key) => {
    return {
      sums: {
        budget: result.sums.budget + value[0],
        popularity: result.sums.popularity + value[1],
        revenue: result.sums.revenue + value[2],
        runtime: result.sums.runtime + value[3],
        voteAverage: result.sums.voteAverage + value[4],
        voteCount: result.sums.voteCount + value[5],
        release: result.sums.release + value[6],
      },
      mins: {},
      maxs: {},
    };
  }, initCoefficients);

  const means = {
    budgetMean: helperCoefficients.sums.budget / M,
    popularityMean: helperCoefficients.sums.popularity / M,
    revenueMean: helperCoefficients.sums.revenue / M,
    runtimeMean: helperCoefficients.sums.runtime / M,
    voteAverageMean: helperCoefficients.sums.voteAverage / M,
    voteCountMean: helperCoefficients.sums.voteCount / M,
    releaseMean: helperCoefficients.sums.release / M,
  };

  const ranges = {
  //   budgetRange: coefficients.maxs.budget - coefficients.mins.budget,
  //   popularityRange: coefficients.maxs.popularity - coefficients.mins.popularity,
  //   revenueRange: coefficients.maxs.revenue - coefficients.mins.revenue,
  //   runtimeRange: coefficients.maxs.runtime - coefficients.mins.runtime,
  //   voteAverageRange: coefficients.maxs.voteAverage - coefficients.mins.voteAverage,
  //   voteCountRange: coefficients.maxs.voteCount - coefficients.mins.voteCount,
  //   releaseRange: coefficients.maxs.release - coefficients.mins.release,
  };

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

    // featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.genresDictionary, 'genres'));
    // featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.overviewDictionary, 'overview'));
    // featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.studioDictionary, 'studio'));
    // featureVector.push(...toFeaturizedFromDictionary(movie, dictionaries.keywordsDictionary, 'keywords'));

    return featureVector;
  }
}

function toFeaturizedNumber(movie, property) {
  const number = Number(movie[property]);
  // Fallback for NaN
  if (number > 0 || number === 0) {
    return number;
  } else {
    return 0;
  }
}

function toFeaturizedRelease(movie) {
  return Number(movie.release ? (movie.release).slice(0, 4) : '');
}

function toFeaturizedAdult(movie) {
  return movie.adult === 'False' ? 0 : 1;
}

function toFeaturizedHomepage(movie) {
  return movie.homepage ? 0 : 1;
}

function toFeaturizedLanguage(movie) {
  return movie.language === 'eng' ? 1 : 0;
}

function toFeaturizedFromDictionary(movie, dictionary, property) {
  // Fallback, because not all movies have associated keywords
  const propertyIds = (movie[property] || []).map(value => value.id);
  const isIncluded = (value) => propertyIds.includes(value.id) ? 1 : 0;
  return dictionary.map(isIncluded);
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