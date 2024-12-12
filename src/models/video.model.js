import mongoose from "mongoose";
import mongooseAggregatePaginate from 'mongooseAggregatePaginate'

const videoschema = new mongoose.Schema(
  {
    videoFile: {
      type: String, //cloudinary url
      required: true
    },
    thumbnail: {
      type: String, //cloudinary url
      required: true
    },
    title:{
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    duration: {
      type : Number,
      required: true
    },
    views: {
      type: Number,
      default: 0
    },
    ispublished: {
       type: Boolean,
       default: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {timestamps: true}
)
videoschema.plugin(mongooseAggregatePaginate)
export const Video = mongoose.model('Video',videoschema)