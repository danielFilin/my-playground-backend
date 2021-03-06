const express = require('express');
const { check } = require('express-validator');

const placesControllers = require('../controllers/places-controllers');
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

const router = express.Router();

router.get('/', placesControllers.getPlaces);

router.get('/:placeId', placesControllers.getPlaceById);

router.get('/user/:userId', placesControllers.getPlacesByUserId);

router.use(checkAuth);

router.post(
    '/', fileUpload.single('image'),  [
    // '/', fileUpload.array('image',3), [
    check('title').not().isEmpty(),
    check('description').isLength({min: 5}),
    check('address').not().isEmpty()
], placesControllers.createPlace);

router.post('/pictures/:placeId', fileUpload.single('image'),
    placesControllers.imageUpload);

router.patch('/:placeId', fileUpload.single('image'), [
    check('title').not().isEmpty(),
    check('description').isLength({min: 5}),
], placesControllers.updatePlaceById);

router.patch('/rate/:placeId', [
    check('rating').not().isEmpty(),
], placesControllers.updatePlaceById);

router.patch('/comment/:placeId',
 [
    check('comment').not().isEmpty(),
],
placesControllers.updatePlaceById);

router.delete('/comments/:placeId/:commentId', placesControllers.deleteComment);

router.delete('/:placeId', placesControllers.deletePlace);

module.exports = router;