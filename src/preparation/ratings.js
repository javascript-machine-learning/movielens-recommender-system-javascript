function prepareRatings(ratings) {
  console.log('Preparing Ratings ... \n');

  const ratingCountsByMovie = getRatingCountsByMovie(ratings);
  const ratingCountsByUser = getRatingCountsByUser(ratings);

  const POPULARITY_TRESHOLD = {
    movieRatings: 50, // be careful not to exclude the movies of your focused user
    userRatings: 5, // be careful not to exclude your focused user
  };

  console.log('(1) Group ratings by user');
  const ratingsGroupedByUser = getRatingsGroupedByUser(
    ratings,
    ratingCountsByMovie,
    ratingCountsByUser,
    POPULARITY_TRESHOLD
  );

  console.log('(2) Group ratings by movie \n');
  const ratingsGroupedByMovie = getRatingsGroupedByMovie(
    ratings,
    ratingCountsByMovie,
    ratingCountsByUser,
    POPULARITY_TRESHOLD
  );

  return { ratingsGroupedByUser, ratingsGroupedByMovie };
}

export function getRatingCountsByUser(ratings) {
  return ratings.reduce((result, value) => {
    const { userId, rating } = value;

    if (!result[userId]) {
      result[userId] = 0;
    }

    result[userId]++;

    return result;
  }, {});
}

export function getRatingCountsByMovie(ratings) {
  return ratings.reduce((result, value) => {
    const { movieId, rating } = value;

    if (!result[movieId]) {
      result[movieId] = 0;
    }

    result[movieId]++;

    return result;
  }, {});
}

export function getRatingsGroupedByMovie(ratings, ratingCountsByMovie, ratingCountsByUser, popularityThreshold) {
  const { movieRatings, userRatings } = popularityThreshold;

  return ratings.reduce((result, value) => {
    const { userId, movieId, rating, timestamp } = value;

    if (ratingCountsByMovie[movieId] < movieRatings || ratingCountsByUser[userId] < userRatings) {
      return result;
    }

    if (!result[movieId]) {
      result[movieId] = {};
    }

    result[movieId][userId] = { rating: Number(rating), timestamp };

    return result;
  }, {});
}

export function getRatingsGroupedByUser(ratings, ratingCounts, popularity) {
  return ratings.reduce((result, value) => {
    const { userId, movieId, rating } = value;

    if (ratingCounts[movieId] < popularity) {
      return result;
    }

    if (!result[userId]) {
      result[userId] = {};
    }

    result[userId][movieId] = { rating: Number(rating) };

    return result;
  }, {});
}

export default prepareRatings;