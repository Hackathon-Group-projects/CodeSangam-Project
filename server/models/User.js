const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,          // bcrypt hashed
  role: { type: String, enum: ['citizen', 'official', 'admin'], default: 'citizen' },
  department: String,        // for officials
  createdAt: { type: Date, default: Date.now }
});
