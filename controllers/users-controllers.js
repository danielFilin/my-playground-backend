const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user');

const getAllUsers = async (req, res, next) => {
    let users;
    try {
        users = await User.find({}, '-password');
    } catch (err) {
        return next( new HttpError('Fetching users failed', 500));
    }

    res.json({
        users: users.map( user => user.toObject({getters: true}))
    })
}

const signup = async (req, res, next) =>{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new HttpError('Invalid inputs passed, please check your data', 422);
        return next(error);
    }
    const { name, email, password} = req.body;
    let existingUser;
    try {
        existingUser = await User.findOne({email: email});
    } catch (err) {
        const error = new HttpError('Signing up failed, please try again', 500);
        return next(error);
    }

    if (existingUser) {
        const error = new HttpError('User with this email exists already', 422);
        return next(error);
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
        return next(new HttpError('Could not create user, please try again', 500));
    }
   
    const createdUser = new User({
        name,
        email,
        image: req.file.path,
        password: hashedPassword,
        places: []
    });
    try {
        await createdUser.save();

    } catch (err) {
        const error = new HttpError('Creating user Failed', 500);
        return next(error);
    }
    let token;
    try {
        token = jwt.sign({
            userId: createdUser.id, email: createdUser.email},
            process.env.JWT_KEY,
            {expiresIn: '1h'}
        );
    } catch (err) {
        return next(new HttpError('Signing up failed, please try again', 500));
    }

    res
        .status(201)
        .json({
            userId: createdUser.id, 
            email: createdUser.email, 
            token: token
        });
}

const login = async (req, res, next) =>{
    const { email, password } = req.body;
    let existingUser;
    try {
        existingUser = await User.findOne({email: email});
    } catch (err) {
        const error = new HttpError('Login failed, please try again', 500);
        return next(error);
    }
    if (!existingUser) {
        const error = new HttpError('Invalid credential!!', 403);
        return next(error);
    }

    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        return next(new HttpError('Login failed, please try again', 500));
    }
    
    if (!isValidPassword) {
        return next(new HttpError('It seems that you used wrong credentials', 500));
    }

    let token;
    try {
        token = jwt.sign({
            userId: existingUser.id, email: existingUser.email},
            process.env.JWT_KEY,
            {expiresIn: '1h'}
        );
    } catch (err) {
        return next(new HttpError('Logging in failed, please try again', 500));
    }

    res.json({
        userId: existingUser.id,
        email: existingUser.email,
        token: token
    })
};

exports.getAllUsers = getAllUsers;
exports.login = login;
exports.signup = signup;