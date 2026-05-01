// scripts/create-admin.ts
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-content-writer';

interface AdminUser {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'admin';
  isActive: boolean;
  isEmailVerified: boolean;
}

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Define Admin Schema
    const adminSchema = new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      phone: { type: String },
      role: { type: String, enum: ['admin', 'customer'], default: 'customer' },
      isActive: { type: Boolean, default: true },
      isEmailVerified: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    });

    const Admin = mongoose.models.Admin || mongoose.model('User', adminSchema);

    // Admin user data
    const adminData: AdminUser = {
      name: 'Super Admin',
      email: 'admin@aiwriter.com',
      password: 'Admin@123456',
      phone: '+1234567890',
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    };

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: adminData.email });
    
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists!');
      console.log(`📧 Email: ${adminData.email}`);
      
      // Update existing admin to ensure admin role
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        existingAdmin.isEmailVerified = true;
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      }
      
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);

    // Create admin user
    const admin = new Admin({
      ...adminData,
      password: hashedPassword,
    });

    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: admin@aiwriter.com');
    console.log('🔑 Password: Admin@123456');
    console.log('👤 Role: Administrator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the password after first login!');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

// Run the script
createAdmin();