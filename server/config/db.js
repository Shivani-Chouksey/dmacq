import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    console.log("process.env.MONGO_URI",process.env.MONGO_URI);
    
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error(" MongoDB Connection Failed");
    console.error(error);
    process.exit(1);
  }
};