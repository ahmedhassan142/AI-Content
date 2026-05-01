// scripts/fix-admin-password.ts
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-content-writer';

async function fixAdminPassword() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the User model
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
      name: String,
      email: String,
      password: String,
      role: String,
      isActive: Boolean,
      isEmailVerified: Boolean,
    }));

    // Check if admin exists
    let admin = await User.findOne({ email: 'admin@aiwriter.com' });
    
    if (!admin) {
      console.log('⚠️ Admin not found, creating new admin...');
      
      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('Admin@123456', salt);
      
      // Create admin
      admin = new User({
        name: 'Super Admin',
        email: 'admin@aiwriter.com',
        password: hashedPassword,
        phone: '+1234567890',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
      });
      
      await admin.save();
      console.log('✅ Admin created successfully!');
    } else {
      console.log('✅ Admin found, updating password...');
      
      // Hash new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('Admin@123456', salt);
      
      // Update admin
      admin.password = hashedPassword;
      admin.role = 'admin';
      admin.isActive = true;
      admin.isEmailVerified = true;
      await admin.save();
      
      console.log('✅ Admin password updated successfully!');
    }

    // Verify the password works
    const isValid = await bcrypt.compare('Admin@123456', admin.password);
    console.log(`🔐 Password verification test: ${isValid ? '✅ SUCCESS' : '❌ FAILED'}`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: admin@aiwriter.com');
    console.log('🔑 Password: Admin@123456');
    console.log('👤 Role: Administrator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAdminPassword();