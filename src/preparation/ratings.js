function prepareRatings(ratings) {
  console.log('Preparing Ratings ... \n');

  console.log('(1) Group ratings by user');
  const ratingsGroupedByUser = getRatingsGroupedByUser(ratings);

  console.log('(2) Group ratings by movie \n');
  const ratingsGroupedByMovie = getRatingsGroupedByMovie(ratings);

  return { ratingsGroupedByUser, ratingsGroupedByMovie };
}

export function getRatingsGroupedByMovie(ratings) {
  return ratings.reduce((result, value) => {
    const { userId, movieId, rating, timestamp } = value;

    if (!result[movieId]) {
      result[movieId] = {};
    }

    result[movieId][userId] = { rating: Number(rating), timestamp };

    return result;
  }, {});
}

export function getRatingsGroupedByUser(ratings) {
  return ratings.reduce((result, value) => {
    const { userId, movieId, rating, timestamp } = value;

    if (!result[userId]) {
      result[userId] = {};
    }

    result[userId][movieId] = { rating: Number(rating), timestamp };

    return result;
  }, {});
}

export default prepareRatings;