// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dy57mrcvp",
  api_key: process.env.CLOUDINARY_API_KEY || "441446733331616",
  api_secret: process.env.CLOUDINARY_API_SECRET || "tZ1Yw0AId2udivtUpEZL0NjeonY",
  secure: true
});

export default cloudinary;