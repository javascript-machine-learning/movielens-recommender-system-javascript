// https://www.kaggle.com/rounakbanik/the-movies-dataset/data
// Exercise: Use credits data with crew and cast too
// Exercise: Make feature more weighted based on popularity or actors

import fs from 'fs';
import csv from 'fast-csv';

import prepareRatings from './preparation/ratings';
import prepareMovies from './preparation/movies';
import predictWithLinearRegression from './strategies/linearRegression';
import predictWithContentBased from './strategies/contentBased';
import { predictWithCfUserBased, predictWithCfItemBased } from './strategies/collaborativeFiltering/userBased';

const ARTIFICIAL_USER_RATINGS = [
  {
    userId: '0',
    movieId: '155', // The Dark Knight
    rating: '5.0',
  },
  {
    userId: '0',
    movieId: '49026', // The Dark Knight Rises
    rating: '4.0',
  },
  {
    userId: '0',
    movieId: '40662', // Batman: Under the Red Hood
    rating: '3.0',
  },
  {
    userId: '0',
    movieId: '58574', // Sherlock Holmes: A Game of Shadows
    rating: '4.0',
  },
  {
    userId: '0',
    movieId: '44038', // Lovecraft: Fear of the Unknown
    rating: '3.0',
  },
  {
    userId: '0',
    movieId: '415', // Batman & Robin
    rating: '4.0',
  },
  {
    userId: '0',
    movieId: '1726', // Iron Man
    rating: '5.0',
  },
  {
    userId: '0',
    movieId: '457', // Sissi
    rating: '1.0',
  },
  {
    userId: '0',
    movieId: '597', // Titanic
    rating: '1.0',
  },
];

let MOVIES_META_DATA = {};
let MOVIES_KEYWORDS = {};
let RATINGS = [...ARTIFICIAL_USER_RATINGS];

let ME_USER_INDEX = 0;

let moviesMetaDataPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/movies_metadata.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromMetaDataFile)
    .on('end', () => resolve(MOVIES_META_DATA)));

let moviesKeywordsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/keywords.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromKeywordsFile)
    .on('end', () => resolve(MOVIES_KEYWORDS)));

let ratingsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/ratings_small.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromRatingsFile)
    .on('end', () => resolve(RATINGS)));

function fromMetaDataFile(row) {
  MOVIES_META_DATA[row.id] = {
    id: row.id,
    adult: row.adult,
    budget: row.budget,
    genres: softEval(row.genres, []),
    homepage: row.homepage,
    language: row.original_language,
    title: row.original_title,
    overview: row.overview,
    popularity: row.popularity,
    studio: softEval(row.production_companies, []),
    release: row.release_date,
    revenue: row.revenue,
    runtime: row.runtime,
    voteAverage: row.vote_average,
    voteCount: row.vote_count,
  };
}

function fromKeywordsFile(row) {
  MOVIES_KEYWORDS[row.id] = {
    keywords: softEval(row.keywords, []),
  };
}

function fromRatingsFile(row) {
  RATINGS.push(row);
}

console.log('Unloading data from files ... \n');

Promise.all([
  moviesMetaDataPromise,
  moviesKeywordsPromise,
  ratingsPromise,
]).then(init);

function init([ moviesMetaData, moviesKeywords, ratings ]) {
  /* ------------ */
  //  Preparation //
  /* -------------*/

  const {
    MOVIES_BY_ID,
    MOVIES_IN_LIST,
    X,
  } = prepareMovies(moviesMetaData, moviesKeywords);

  const {
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
  } = prepareRatings(ratings);

  /* ----------------------------- */
  //  Linear Regression Prediction //
  //        Gradient Descent       //
  /* ----------------------------- */

  /*** UNCOMMENT TO USE RECOMMENDER STRATEGY

  console.log('Linear Regression Prediction ... \n');

  console.log('(1) Training \n');
  const meUserRatings = ratingsGroupedByUser[ME_USER_INDEX];
  const linearRegressionBasedRecommendation = predictWithLinearRegression(X, MOVIES_IN_LIST, meUserRatings);

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(linearRegressionBasedRecommendation, MOVIES_BY_ID, 10, true));

  ***/

  /* ------------------------- */
  //  Content-Based Prediction //
  //  Cosine Similarity Matrix //
  /* ------------------------- */

  /*** UNCOMMENT TO USE RECOMMENDER STRATEGY

  console.log('Content-Based Prediction ... \n');

  console.log('(1) Computing Cosine Similarity \n');
  const title = 'Batman Begins';
  const contentBasedRecommendation = predictWithContentBased(X, MOVIES_IN_LIST, title);

  console.log(`(2) Prediction based on "${title}" \n`);
  console.log(sliceAndDice(contentBasedRecommendation, MOVIES_BY_ID, 10, true));

  ***/

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             User-Based              //
  /* ----------------------------------- */

  console.log('Collaborative-Filtering Prediction ... \n');

  console.log('(1) Computing User-Based Cosine Similarity \n');
  // const cfUserBasedRecommendation = predictWithCfUserBased(
  //   ratingsGroupedByUser,
  //   ratingsGroupedByMovie,
  //   ME_USER_INDEX
  // );

  const cfUserBasedRecommendation = predictWithCfItemBased(
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
    ME_USER_INDEX
  );

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfUserBasedRecommendation, MOVIES_BY_ID, 10, true));

  console.log('\n');
  console.log('End ...');
}

export function sliceAndDice(recommendations, MOVIES_BY_ID, count, onlyTitle) {
  recommendations = recommendations.filter(recommendation => MOVIES_BY_ID[recommendation.movieId]);

  recommendations = onlyTitle
    ? recommendations.map(mr => ({ title: MOVIES_BY_ID[mr.movieId].title, prediction: mr.prediction }))
    : recommendations.map(mr => ({ movie: MOVIES_BY_ID[mr.movieId], prediction: mr.prediction }));

  return recommendations
    .slice(0, count);
}

export function softEval(string, escape) {
  if (!string) {
    return escape;
  }

  try {
    return eval(string);
  } catch (e) {
    return escape;
  }
}