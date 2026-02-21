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
  } else {
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

  // 2. 创建预设标签
  const predefinedTags = [
    '科幻',
    '悬疑',
    '动作',
    '爱情',
    '喜剧',
    '恐怖',
    '剧情',
    '动画',
    '冒险',
    '犯罪',
    '历史',
    '战争',
    '纪录片',
    '音乐',
    '家庭',
    '高分',
    '经典',
    '治愈',
    '烧脑',
    '催泪',
  ];

  console.log('\n🏷️  开始创建预设标签...');

  for (const tagName of predefinedTags) {
    const existingTag = await prisma.tag.findUnique({
      where: { name: tagName },
    });

    if (!existingTag) {
      await prisma.tag.create({
        data: { name: tagName },
      });
      console.log(`   ✅ 标签创建: ${tagName}`);
    } else {
      console.log(`   ⏭️  标签已存在: ${tagName}`);
    }
  }

  console.log('\n✨ 种子数据创建完成!');
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
