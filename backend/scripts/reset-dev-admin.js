const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");

const DEFAULT_ADMIN = {
  username: "admin",
  email: "admin@yosem.local",
  name: "超级管理员",
  role: "superadmin",
  status: "active",
  password: "123456",
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset the development admin account in production.");
  }

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yosem_ai";
  const client = new MongoClient(mongoUri);

  await client.connect();

  try {
    const db = client.db();
    const users = db.collection("users");
    const sessions = db.collection("auth_sessions");
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    const existingAdmin = await users.findOne({
      $or: [{ username: DEFAULT_ADMIN.username }, { email: DEFAULT_ADMIN.email }],
      role: "superadmin",
    });

    const nextTokenVersion =
      typeof existingAdmin?.tokenVersion === "number" ? existingAdmin.tokenVersion + 1 : 1;
    const adminId = existingAdmin?._id || new ObjectId();

    await users.updateOne(
      { _id: adminId },
      {
        $set: {
          username: DEFAULT_ADMIN.username,
          email: DEFAULT_ADMIN.email,
          name: DEFAULT_ADMIN.name,
          role: DEFAULT_ADMIN.role,
          status: DEFAULT_ADMIN.status,
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          lastLogoutAt: new Date(),
          tokenVersion: nextTokenVersion,
        },
        $setOnInsert: {
          _id: adminId,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    await sessions.updateMany(
      { userId: adminId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    console.log(
      `Development admin is ready.\nemail: ${DEFAULT_ADMIN.email}\nusername: ${DEFAULT_ADMIN.username}\npassword: ${DEFAULT_ADMIN.password}`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
