import {asynHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'

const registerUser = asynHandler(async (req,res)=>{
  // get user details frontend
  // validation - not empty
  // check if user already exists: username,email
  // check for images, check for avatar
  // upload them to cloudinary, avtar
  //create user object - create entry in db
  // remove password and refresh token field from creation
  //check for user creation
  // return response
  

// get user details frontend
  const {fullname,email,username,password} = req.body
  console.log("email: ",email)


// validation - not empty
if(
  [fullname,username,email,password].some((field)=> field?.trim() === "")
) {
  throw new ApiError(400,'All fiels are required')
}

  // check if user already exists: username,email
  const existedUser = User.findOne({
    $or: [{ username },{ email }]
  })
  
  if(existedUser){
    throw new ApiError(409,'User with email or username already exists')
  }

  // check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files.coverImage[0]?.path

  if(!avatarLocalPath){
    throw new ApiError(400, 'Avatar file is required')
  }

  // upload them to cloudinary, avtar  
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!avatar){
    throw new ApiError(400,'Avatar file is required')
  }

  //create user object - create entry in db
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  // remove password and refresh token field from creation

  const createdUser = await User.findById(user._id).select("-password -refreshToken")

   //check for user creation
   if(!createdUser){
    throw new ApiError(500,"something went wrong while registering the user")
   }

   // return response
   return res.status(201).json(
    new ApiResponse(200,createdUser,'User registered successfully')
   )

})

export {registerUser}