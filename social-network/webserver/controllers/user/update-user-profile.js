'use strict';

const dot = require('dot-object');
const Joi = require('joi');

const UserModel = require('../../../models/user-model');

async function validate(payload) {
  const schema = {
    fullName: Joi.string().min(3).max(128).required(),
    preferences: Joi.object().keys({
      isPublicProfile: Joi.bool().required(),
      linkedIn: Joi.string().allow(null),
      twitter: Joi.string().allow(null),
      github: Joi.string().uri().allow(null),
      description: Joi.string().allow(null),
    }),
  };

  return Joi.validate(payload, schema);
}

async function updateUserProfile(req, res, next) {
  const userDataProfile = { ...req.body };
  const { claims } = req;

  try {
    await validate(userDataProfile);
  } catch (e) {
    return res.status(400).send(e);
  }

  /**
   * 2. Insertar los datos en mongo (actualizar los datos del usuario en mongo)
   */
  /*
  const userDataProfileMongoose = {
    fullName: userDataProfile.fullName,
    'preferences.isPublicProfile': userDataProfile.preferences.isPublicProfile,
    'preferences.linkedIn': userDataProfile.preferences.linkedIn,
    'preferences.twitter': userDataProfile.preferences.twitter,
    'preferences.github': userDataProfile.preferences.github,
    'preferences.description': userDataProfile.preferences.description,
  };
  */

  try {
    const userDataProfileMongoose = dot.dot(userDataProfile);
    const data = await UserModel.updateOne({ uuid: claims.uuid }, userDataProfileMongoose);
    console.log('mongoose data', data);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).send(err.message);
  }
}

module.exports = updateUserProfile;
