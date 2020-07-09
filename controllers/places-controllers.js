const fs = require('fs');

const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');
const { error } = require('console');


const getPlaces = async (req, res, next) => {
    let places;
    try {
        places = await Place.find().populate('places');
        if (!places || places.length === 0) {
            throw Error;
        }

        res.json({
            places: places.map( place => place.toObject({getters: true}))
        })
    } catch (err) {
        const error = new HttpError('no places found!', 500);
        return next(error)
    }
}

const getPlaceById = async (req, res, next) => {
    try {
        const placedId = req.params.placeId;
        const place = await Place.findById(placedId);
        if (!place) {
            throw Error;
        } 
        res.json({
            place: place.toObject( {getters: true})
            });
    } catch (err) {
        const error = new HttpError('no places found for the given id!', 500);
        return next(error);
    }
}

const getPlacesByUserId = async (req, res, next) => {
        const userId = req.params.userId;
        let userPlaces;
        try {
            userPlaces = await User.findById(userId).populate('places');
            if (!userPlaces || userPlaces.length === 0) {
                throw Error;
            }
            res.json({
                places: userPlaces.places.map( place => place.toObject({getters: true}))
            })
        } catch (err) {
            const error = new HttpError('no places found for the given id!', 500);
            return next(error)
        }
      
}

const createPlace = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors);
        return next(new HttpError('Invalid inputs passed, please check your data', 422));
    }
    const {title, description, address, fence, publicWC, safety, foodDrink, waterSurface} = req.body;
    let coordinates;
    try {
         coordinates = await getCoordsForAddress(address);
    }  catch(err) {
        return next(err);
    }
    const createdPlace = new Place({
        title,
        description,
        address,
        fence,
        publicWC,
        safety,
        foodDrink,
        waterSurface,
        location: coordinates,
        image: req.file.path,
        creator: req.userData.userId
    });
    let user;
    try {
        user = await User.findById(req.userData.userId);
    } catch (err) {
        return next(new HttpError('Creating place failed', 500))
    }

    if (!user) {
        return next(new HttpError('could not find user with the given id', 404));
    }
   
    try {
        const currentSession = await mongoose.startSession();
        currentSession.startTransaction();
        await createdPlace.save({session: currentSession});
        user.places.push(createdPlace);
        await user.save({ session: currentSession});
        await currentSession.commitTransaction();
     
    } catch(err) {
        const error = new HttpError(
            'Creating place failed, please try again', 500
        );
        return next(error);
    }
  
    res.status(201).json({
        place: createdPlace
    });
}

// const ratePlaceById = async (req, res, next) => {

// }

const calculateAverageRating = async (placeId) => {
    let place = await Place.findById(placeId); 
    let sum = 0;
    let i = 0; 
    for (let rating of place.rating) {
        sum += rating.stars;
        i++
    }
    sum = sum/i;
    place.avgStars = sum;

    //console.log(place);
    try {
        place.save();
    } catch (err) {
        throw new error('Failed to save data correctly', 500);
    }
   
}

const updatePlaceById = async (req, res, next) => {
    try{
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log(errors);
            return next(new HttpError('Invalid inputs passed, please check your data', 422));
        }
        const {title, description, rating, userId, comment} = req.body;
        // the way I pass comment and rating is not correct, I want to send an object with the data with 
        // some props, but get only the props
        const placeId = req.params.placeId;
        let updatedPlace = await Place.findById(placeId); 
        if (rating) {
            const data = {
                stars: rating,
                userId: userId
            }
            const info = updatedPlace.rating.toObject();
            let isRated = false;
            let curIndex;
            for (let [index, item] of info.entries()) {    
                if (item.userId === userId) {
                    isRated = true;
                    curIndex = index;
                }
            }
            if (isRated) {
                updatedPlace.rating[curIndex].stars = data.stars;
            } else {
                updatedPlace.rating.push(data);
            }
            
            await updatedPlace.save();
            calculateAverageRating(placeId);
        } else if (comment) {
            existingUser = await User.findById(userId);
            const data = {
                userName: existingUser.name,
                comment: comment
            }
            updatedPlace.comments.push(data);
            await updatedPlace.save()
        } else {
            updatedPlace.title = title;
            updatedPlace.description = description;
            updatedPlace.image = req.file.path;
            await updatedPlace.save()
        }
       
    
        res.status(200).json({
            place: updatedPlace.toObject({getters: true})
        });
    } catch (err) {
        const error = new HttpError('no places found for the given id!', 500);
        return next(error)
    } 
}

const deletePlace = async (req, res, next) => {
    try {
        const placeId =  req.params.placeId;
        const placeToDelete = await Place.findById(placeId).populate('creator');
        if (!placeToDelete) {
            throw Error;
        }

        if (placeToDelete.creator.id !== req.userData.userId) {
            return next(new HttpError('You are not allowed to delete this place', 401));
        }
        const imagePath = placeToDelete.image[0];

        const currentSession = await mongoose.startSession();
        currentSession.startTransaction();
        await placeToDelete.remove({session: currentSession});
        placeToDelete.creator.places.pull(placeToDelete);
        await placeToDelete.creator.save({session: currentSession});
        await currentSession.commitTransaction();
        fs.unlink(imagePath, err => {
            console.log(err)
                });
        res.status(200).json({
            message: 'place deleted'
        });
    } catch (err) {
        const error = new HttpError('The place was not deleted!', 500);
        return next(error)
    }
 
}

const deleteComment = async (req, res) => {
    try {
        const placeId = req.params.placeId;
        const place = await Place.findById(placeId);
        if (!place) {
            throw Error;
        } 
        const itemId = req.params.commentId;
        let comments = place.comments;
        const filteredComments = comments.filter(comment => comment._id != itemId);
        place.comments = filteredComments;
        await place.save();
        console.log(place.comments);
        res.status(200).json({
            comments: place.comments
        });
    } catch (err) {
        const error = new HttpError('no places found for the given id!', 500);
        return next(error);
    }
}

const imageUpload = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors);
        return next(new HttpError('Invalid inputs passed, please check your data', 422));
    }

    const placeId = req.params.placeId;
    let updatedPlace = await Place.findById(placeId); 
    updatedPlace.image.push(req.file.path);
    try {
        await updatedPlace.save();
        res.status(200).json({
            message: 'File saved'
        });
    } catch (err) {
        return next(new HttpError('Saving file failed', 500));
    }
}

exports.imageUpload = imageUpload;
exports.getPlaceById = getPlaceById;
exports.getPlaces = getPlaces;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlaceById = updatePlaceById;
exports.deletePlace = deletePlace;
exports.deleteComment = deleteComment;