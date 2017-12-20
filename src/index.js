// https://www.kaggle.com/rounakbanik/the-movies-dataset/data

import fs from 'fs';
import csv from 'fast-csv';
import synchronizedShuffle from 'synchronized-array-shuffle';

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
    overview: row.overview,
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

  let movies = zip(moviesMetaData, moviesKeywords);
  // console.log(movies[577]);

  let genresDictionary = toDictionary(movies, 'genres');
  let studioDictionary = toDictionary(movies, 'studio');
  let keywordsDictionary = toDictionary(movies, 'keywords');

  genresDictionary = filterByThreshold(genresDictionary, 1);
  studioDictionary = filterByThreshold(studioDictionary, 50);
  keywordsDictionary = filterByThreshold(keywordsDictionary, 100);

  console.log(keywordsDictionary.length);
}

function filterByThreshold(dictionary, threshold) {
  return Object.keys(dictionary)
    .filter(key => dictionary[key].count > threshold)
    .map(key => dictionary[key]);
}

function toDictionary(object, property) {
  const dictionary = {};

  object.forEach((value) => {
    (value[property] || []).forEach((innerValue) => {
    // value[property].forEach((innerValue) => {
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