'use strict';

const bcrypt = require('bcrypt');
const Joi = require('joi');
const uuidV4 = require('uuid/v4');
const sendgridMail = require('@sendgrid/mail');
const mysqlPool = require('../../databases/mysql-pool');
const WallModel = require('../../models/wall-model');
const UserModel = require('../../models/user-model');

sendgridMail.setApiKey(process.env.SENDGRID_API_KEY);

async function validateSchema(payload) {
  /**
   * TODO: Fill email, password and full name rules to be (all fields are mandatory):
   *  email: Valid email
   *  password: Letters (upper and lower case) and number
   *    Minimun 3 and max 30 characters, using next regular expression: /^[a-zA-Z0-9]{3,30}$/
   * fullName: String with 3 minimun characters and max 128
   */
  const schema = {
    email: Joi.string().email({ minDomainAtoms: 2 }).required(),
    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
  };

  return Joi.validate(payload, schema);
}

/**
 * Create users wall
 * @param {String} uuid User identifier
 * @return {Object} wall Users wall
 */
async function createWall(uuid) {
  const data = {
    uuid,
    posts: [],
  };

  const wall = await WallModel.create(data);

  return wall;
}

async function createProfile(uuid) {
  const userProfileData = {
    uuid,
    avatarUrl: null,
    fullName: null,
    friends: [],
    preferences: {
      isPublicProfile: false,
      linkedIn: null,
      twitter: null,
      github: null,
      description: null,
    },
  };

  const profileCreated = await UserModel.create(userProfileData);

  return profileCreated;
}

/**
 * Crea un codigo de verificacion para el usuario dado e inserta este codigo
 * en la base de datos
 * @param {String} uuid
 * @return {String} verificationCode
 */
async function addVerificationCode(uuid) {
  const verificationCode = uuidV4();
  const now = new Date();
  const createdAt = now.toISOString().substring(0, 19).replace('T', ' ');
  const sqlQuery = 'INSERT INTO users_activation SET ?';
  const connection = await mysqlPool.getConnection();

  await connection.query(sqlQuery, {
    user_uuid: uuid,
    verification_code: verificationCode,
    created_at: createdAt,
  });

  connection.release();

  return verificationCode;
}

async function sendEmailRegistration(userEmail, verificationCode) {
  const linkActivacion = `http://localhost:3000/api/account/activate?verification_code=${verificationCode}`;
  const msg = {
    to: userEmail,
    from: {
      email: 'socialnetwork@yopmail.com',
      name: 'Social Network :)',
    },
    subject: 'Welcome to Hack a Bos Social Network',
    text: 'Start meeting people of your interests',
    html: `To confirm the account <a href="${linkActivacion}">activate it here</a>`,
  };

  const data = await sendgridMail.send(msg);

  return data;
}

async function createAccount(req, res, next) {
  const accountData = req.body;

  try {
    await validateSchema(accountData);
  } catch (e) {
    return res.status(400).send(e);
  }

  /**
   * Tenemos que insertar el usuario en la bbdd, para ello:
   * 1. Generamos un uuid v4
   * 2. Miramos la fecha actual created_at
   * 3. Calculamos hash de la password que nos mandan para almacenarla
   * de forma segura en la base de datos
   */
  const now = new Date();
  const securePassword = await bcrypt.hash(accountData.password, 10);
  const uuid = uuidV4();
  const createdAt = now.toISOString().substring(0, 19).replace('T', ' ');

  const connection = await mysqlPool.getConnection();

  const sqlInsercion = 'INSERT INTO users SET ?';

  try {
    const resultado = await connection.query(sqlInsercion, {
      uuid, // uuid: uuid,
      email: accountData.email,
      password: securePassword,
      created_at: createdAt,
    });
    connection.release();

    const verificationCode = await addVerificationCode(uuid);

    await sendEmailRegistration(accountData.email, verificationCode);
    await createWall(uuid);
    await createProfile(uuid);

    return res.status(201).send();
  } catch (e) {
    if (connection) {
      connection.release();
    }

    return res.status(500).send(e.message);
  }
}

module.exports = createAccount;
