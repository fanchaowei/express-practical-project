import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 创建 PostgreSQL adapter
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || '' });

// 初始化 Prisma Client
const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 开始数据库种子...');

  // 读取环境变量
  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123456';

  // 检查管理员是否已存在
  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existingAdmin) {
    console.log('⚠️  管理员账户已存在，跳过创建');
    return;
  }

  // 加密密码
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPassword, salt);

  // 创建管理员账户
  const admin = await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('✅ 管理员账户创建成功:');
  console.log(`   用户名: ${admin.username}`);
  console.log(`   角色: ${admin.role}`);
  console.log(`   ID: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
