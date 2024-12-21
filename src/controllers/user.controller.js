import {asynHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'
import { error } from 'console'
import mongoose from 'mongoose'

const generateAccessAndRefreshTokens = async (userId) => {
  try {
      // Fetch user by ID
      const user = await User.findById(userId);
      if (!user) {
          throw new ApiError(404, 'User not found');
      }

      // Generate tokens
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      // Save refresh token to the user's record
      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false }); // Save user instance

      // Return tokens
      return { accessToken, refreshToken };
  } catch (error) {
      console.error('Error in generateAccessAndRefreshTokens:', error);
      throw new ApiError(500, 'Something went wrong while generating refresh and access tokens');
  }
};

//register
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


// validation - not empty
if(
  [fullname,username,email,password].some((field)=> field?.trim() === "")
) {
  throw new ApiError(400,'All fiels are required')
}

  // check if user already exists: username,email
  const existedUser =  await User.findOne({
    $or: [{ username },{ email }]
  })
  
  if(existedUser){
    throw new ApiError(409,'User with email or username already exists')
  }

  // check for images, check for avatar
  console.log(req.files)
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage.length > 0)){
    coverImageLocalPath = req.files.coverImage[0].path
  }

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

//login
const loginUser = asynHandler(async(req,res)=>{
  //req body -> data
  // username or email
  //find the user
  //password check
  //access and refresh token
  //send cookie

  //req body -> data
  const {email,username,password} = req.body
  

   // username or email
   if(!(username || email)){
    throw new ApiError(400, 'username or email is required')
   }

   //find the user
   const user = await User.findOne({
    $or: [ {username}, {email}]
   })

   if(!user){
    throw new ApiError(404, 'user does not exist')
   }
  
    //password check
    const isPasswordValid = await user.isPasswordCorrect(password); // Corrected method name

    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid credentials'); // Corrected error message
    }

    //access and refresh token
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select('-password -refreshToken')

    const options = {
      httpOnly: true,
      secure: true,
    }

     //send cookie
     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie('refreshToken',refreshToken,options).json(
      new ApiResponse(
        200,
        {
          user: loggedInUser, accessToken,refreshToken
        },
        "user loggendIn successfully"

      )
     )
     
}
)


//logout
const logoutUser = asynHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set : {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }
  return res
  .status(200)
  .clearCookie('accessToken',options)
  .clearCookie('refreshToken',options)
  .json(new ApiResponse(200,{},'user logged out'))
})


//refreshtoken
const refreshAccessToken = asynHandler(async(req,res)=>{
  const incomeingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomeingRefreshToken){
    throw new ApiError(401,"unauthorized request")
  }
 try{
  const decodedToken  = jwt.verify(incomeingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

  const user = await User.findById(decodedToken?._id)

  if(!user){
   throw new ApiError(401, 'Invalid refresh token')
  }

  if(incomeingRefreshToken !== user?.refreshToken){
   throw new ApiError(401, 'refresh token is expired or used')
  }

  const options = {
   httpOnly: true,
   secure: true
  }
  const {accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(user._id)

  return res.status(200)
  .cookie('accessToken',accessToken,options)
  .cookie('refreshToken', newrefreshToken ,options)
  .json(
   new ApiResponse(
     200,
     {accessToken, refreshToken:newrefreshToken},
     "access token refreshed"
   )
  )
 }catch(error){
  throw new ApiError(401, error?.message || "invalid refresh token")
 }
})

//changepassword
const changeCurrentPassword = asynHandler(async(req,res)=>{
  const {oldPassword,newPassword} = req.body
  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password")
  }
  user.password = newPassword
  await user.save({validateBeforeSave: false})
  
  return res
  .status(200)
  .json(new ApiResponse(200,{} ,'password change successfully'))
  
})

//currentuser
const getCurrentUser = asynHandler(async(req,res)=>{
  return res
  .status(200)
  .json(200, req.user,'current user fetched successfully')
})

//updateaccount
const updateAccountDetails = asynHandler(async(req,res)=>{
  const {fullname,email} = req.body

  if(!fullname || !email){
    throw new ApiError(400,'All fields aew required')
  }
  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200,'Account details updated successfully'))
})

//updateavtar
const updateUserAvatar = asynHandler(async(req,res)=>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400, 'Avatar file is missing')
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400,'error while uploading on avatar')
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {new: true}
  ).select('-password')

  return res
  .status(200)
  .json(
    new ApiResponse(200,user,'avatar updated successfully')
  )

})

//updateCoverImage
const updateCoverImage = asynHandler(async(req,res)=>{
  const coverImageLocalPath = req.file?.path

  if(!coverImageLocalPath){
  throw new ApiError(400, 'Avatar file is missing')
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
   throw new ApiError(400, 'error while uploading on coverImage')
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      set: {
        coverImage: coverImage.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200,user ,'coverImage updated successfully'))

})


//get user channelprofile
const getUserChannelProfile = asynHandler(async(req,res)=>{
  const {username} = req.params

  if(!username?.trim()){
    throw new ApiError(400, 'username is missing')
  }
    const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers'
      }
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribedTo'
      }
    },
    {
      $addFields: {
        subscribsCount: {
          $size: '$subscribers'
        },
        channelsSubscribedCount: {
          $size : '$subscribedTo'
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user._id, "$$subscribers.subscriber"]},
            then: true,
            else: false,
          }
        }
      }
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscribsCount: 1,
        channelsSubscribedCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1
      }
    }
   

  ])

  if(!channel?.length){
    throw new ApiError(404, 'channel does not')
  }
  return res.status(200).json(
    new ApiResponse(200,channel[0], 'user channel fetched successfully')
  )
})

// get wacthHistory
const getWatchHistory = asynHandler(async(req,res)=>{
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'watchHistory',
        foreignField: '_id',
        as: 'watchHisstory',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: '$owner'
              }
            }
          }
        ]
      }
    }

  ])

  return res
  .status(200)
  .json(
    new ApiResponse(
      200, user[0].watchHistory,
      'watch history fetched successfully'
    )
  )
})
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory
}