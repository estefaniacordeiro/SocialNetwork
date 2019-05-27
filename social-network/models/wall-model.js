'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const wallSchema = new Schema({
  uuid: {
    type: String,
    unique: true,
  },
  posts: [Schema.ObjectId],
});

const Wall = mongoose.model('Wall', wallSchema);

module.exports = Wall;
