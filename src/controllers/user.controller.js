import {asynHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'

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
export {
  registerUser,
  loginUser,
  logoutUser
}