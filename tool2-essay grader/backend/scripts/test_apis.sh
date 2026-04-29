#!/bin/bash

# AI作文批阅系统 V2.0 API测试脚本

BASE_URL="http://localhost:8000"

echo "======================================================"
echo "AI作文批阅系统 V2.0 - API测试"
echo "======================================================"

# 1. 健康检查
echo -e "\n[1/8] 测试健康检查..."
curl -s "$BASE_URL/health" | jq .

# 2. 管理员登录
echo -e "\n[2/8] 测试管理员登录..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$ADMIN_RESPONSE" | jq .
ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.access_token')

# 3. 学生登录
echo -e "\n[3/8] 测试学生登录..."
STUDENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"张三","password":"123456"}')
echo "$STUDENT_RESPONSE" | jq .
STUDENT_TOKEN=$(echo "$STUDENT_RESPONSE" | jq -r '.access_token')

# 4. 管理员获取用户列表
echo -e "\n[4/8] 测试管理员获取用户列表（前5个）..."
curl -s -X GET "$BASE_URL/api/users/list?limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# 5. 管理员查看所有批阅记录
echo -e "\n[5/8] 测试管理员查看所有批阅记录..."
curl -s -X GET "$BASE_URL/api/records/all?limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# 6. 学生查看自己的批阅记录
echo -e "\n[6/8] 测试学生查看自己的批阅记录..."
curl -s -X GET "$BASE_URL/api/records/my" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .

# 7. 管理员查看指定学生的批阅记录
echo -e "\n[7/8] 测试管理员查看指定学生的批阅记录..."
curl -s -X GET "$BASE_URL/api/records/student/张三" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# 8. 验证Token
echo -e "\n[8/8] 测试Token验证..."
curl -s -X GET "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .

echo -e "\n======================================================"
echo "测试完成！"
echo "======================================================"
echo "提示："
echo "1. 如果看到大量数据，说明API正常工作"
echo "2. 访问 http://localhost:8000/docs 可以查看完整API文档"
echo "3. 当前数据库中有 1 个管理员 + 62 个学生账号"
echo "======================================================"