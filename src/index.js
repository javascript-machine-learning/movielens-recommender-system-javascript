// https://www.kaggle.com/rounakbanik/the-movies-dataset/data
// Exercise: Content-based - Include credits data with crew and cast too
// Exercise: Content-based - Make features weighted based on popularity or actors
// Exercise: Collaborative Filtering - Model-based CF with SVD

import fs from 'fs';
import csv from 'fast-csv';

import prepareRatings from './preparation/ratings';
import prepareMovies from './preparation/movies';
import predictWithLinearRegression from './strategies/linearRegression';
import predictWithContentBased from './strategies/contentBased';
import { predictWithCfUserBased, predictWithCfItemBased } from './strategies/collaborativeFiltering';
import { getMovieIndexByTitle } from './strategies/common';

let MOVIES_META_DATA = {};
let MOVIES_KEYWORDS = {};
let RATINGS = [];

let ME_USER_ID = 0;

let moviesMetaDataPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/MovieLens/movies_metadata.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromMetaDataFile)
    .on('end', () => resolve(MOVIES_META_DATA)));

let moviesKeywordsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/MovieLens/keywords.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromKeywordsFile)
    .on('end', () => resolve(MOVIES_KEYWORDS)));

let ratingsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/MovieLens/ratings_small.csv')
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

  let ME_USER_RATINGS = [
    addUserRating(ME_USER_ID, 'Terminator 3: Rise of the Machines', '5.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Kill Bill: Vol. 1', '4.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Back to the Future Part II', '3.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Casino Royale', '4.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Reservoir Dogs', '3.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Men in Black II', '3.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Bad Boys II', '5.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Titanic', '1.0', MOVIES_IN_LIST),
  ];

  const {
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
  } = prepareRatings([ ...ME_USER_RATINGS, ...ratings ]);

  /* ----------------------------- */
  //  Linear Regression Prediction //
  //        Gradient Descent       //
  /* ----------------------------- */

  console.log('\n');
  console.log('(A) Linear Regression Prediction ... \n');

  console.log('(1) Training \n');
  const meUserRatings = ratingsGroupedByUser[ME_USER_ID];
  const linearRegressionBasedRecommendation = predictWithLinearRegression(X, MOVIES_IN_LIST, meUserRatings);

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(linearRegressionBasedRecommendation, MOVIES_BY_ID, 10, true));

  /* ------------------------- */
  //  Content-Based Prediction //
  //  Cosine Similarity Matrix //
  /* ------------------------- */

  console.log('\n');
  console.log('(B) Content-Based Prediction ... \n');

  console.log('(1) Computing Cosine Similarity \n');
  const title = 'Batman Begins';
  const contentBasedRecommendation = predictWithContentBased(X, MOVIES_IN_LIST, title);

  console.log(`(2) Prediction based on "${title}" \n`);
  console.log(sliceAndDice(contentBasedRecommendation, MOVIES_BY_ID, 10, true));

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             User-Based              //
  /* ----------------------------------- */

  console.log('\n');
  console.log('(C) Collaborative-Filtering (User-Based) Prediction ... \n');

  console.log('(1) Computing User-Based Cosine Similarity \n');

  const cfUserBasedRecommendation = predictWithCfUserBased(
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
    ME_USER_ID
  );

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfUserBasedRecommendation, MOVIES_BY_ID, 10, true));

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             Item-Based              //
  /* ----------------------------------- */

  console.log('\n');
  console.log('(C) Collaborative-Filtering (Item-Based) Prediction ... \n');

  console.log('(1) Computing Item-Based Cosine Similarity \n');

  const cfItemBasedRecommendation = predictWithCfItemBased(
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
    ME_USER_ID
  );

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfItemBasedRecommendation, MOVIES_BY_ID, 10, true));

  console.log('\n');
  console.log('End ...');
}

// Utility

export function addUserRating(userId, searchTitle, rating, MOVIES_IN_LIST) {
  const { id, title } = getMovieIndexByTitle(MOVIES_IN_LIST, searchTitle);

  return {
    userId,
    rating,
    movieId: id,
    title,
  };
}

export function sliceAndDice(recommendations, MOVIES_BY_ID, count, onlyTitle) {
  recommendations = recommendations.filter(recommendation => MOVIES_BY_ID[recommendation.movieId]);

  recommendations = onlyTitle
    ? recommendations.map(mr => ({ title: MOVIES_BY_ID[mr.movieId].title, score: mr.score }))
    : recommendations.map(mr => ({ movie: MOVIES_BY_ID[mr.movieId], score: mr.score }));

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