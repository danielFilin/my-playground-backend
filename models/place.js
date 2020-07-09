const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const placeSchema = new Schema({
    title: { type: String, required: true},
    description: { type: String, required: true},
    image: [{ type: String, required: true}],
    address: { type: String, required: true},
    fence: { type: Boolean, required: true},
    publicWC: {type: Boolean, required: true},
    foodDrink: {type: Boolean, required: true},
    waterSurface: {type: Boolean, required: true},
    safety: {type: String, required: true},
    location: { 
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    rating: [{
        userId: {type: String, required: false},
        stars: {type: Number, required: false}
    }],
    avgStars: {type: Number, required: false},
    creator: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    comments: [{
        userName: { type: String, required: true },
        comment: { type: String, required: true },
    }]
});

module.exports = mongoose.model('Place', placeSchema);