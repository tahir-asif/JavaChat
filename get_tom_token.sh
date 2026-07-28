TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tom","password":"tom"}' | jq -r '.token')

echo $TOKEN
