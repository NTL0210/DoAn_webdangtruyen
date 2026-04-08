# Huong Dan Chay Redis Local Bang Docker

Tai lieu nay dung de giup nguoi moi trong nhom bat Redis local cho project nay va kiem tra backend da dung Redis that cho cache va rate limit.

## Muc Tieu

Sau khi lam xong, may se co:

- Docker Desktop chay duoc
- Redis container chay local
- Backend ket noi thanh cong toi Redis
- Cache va rate limit cua backend dung Redis that, khong fallback sang memory

## Yeu Cau Truoc Khi Chay

- Windows
- Node.js da cai
- Docker Desktop da cai
- Project da duoc clone ve may

## Neu Docker Desktop Bao Loi WSL

Neu Docker Desktop hien thong bao WSL can cap nhat, mo PowerShell voi quyen admin va chay:

```powershell
wsl --install --no-distribution
wsl --update
wsl --shutdown
```

Sau do dong va mo lai Docker Desktop.

Kiem tra lai:

```powershell
wsl --status
wsl --version
docker version
docker compose version
```

Neu `docker version` hien ca `Client` va `Server` thi Docker da san sang.

## File Lien Quan Trong Project

- [docker-compose.redis.yml](docker-compose.redis.yml): file chay Redis bang Docker
- [backend/.env](backend/.env): backend env local, da tro san toi Redis local
- [backend/scripts/checkRedis.js](backend/scripts/checkRedis.js): script kiem tra backend co ket noi duoc Redis hay khong
- [backend/services/cacheStore.js](backend/services/cacheStore.js): lop cache va rate limit dung Redis-first

## Buoc 1: Bat Docker Desktop

Mo Docker Desktop va doi toi khi engine da chay on dinh.

Co the kiem tra nhanh trong PowerShell:

```powershell
docker version
```

## Buoc 2: Bat Redis Local

Tai root project, chay:

```powershell
docker compose -f docker-compose.redis.yml up -d
```

Neu thanh cong, ban se thay container `demo2-redis` duoc tao va start.

Kiem tra container:

```powershell
docker ps
```

## Buoc 3: Kiem Tra Backend Env

Backend local env dang tro san toi Redis local:

```env
REDIS_URL=redis://127.0.0.1:6379
```

File hien dang dung la [backend/.env](backend/.env).

## Buoc 4: Xac Nhan Backend Da Dung Redis That

Di vao backend va chay script kiem tra:

```powershell
cd backend
npm run redis:check
```

Ket qua dung se giong nhu sau:

```text
[redis-check] Redis connection is ready.
[redis-check] Status: {
  "enabled": true,
  "backend": "redis",
  "redisConfigured": true,
  "connected": true
}
```

Neu thay `backend: "redis"` thi backend dang dung Redis that cho cache va rate limit.

## Buoc 5: Chay Backend

```powershell
cd backend
npm install
npm start
```

Co the kiem tra health endpoint de xem trang thai cache:

```powershell
curl http://localhost:5000/health
```

Trong response, phan `cache` se cho biet backend dang dung `redis` hay `memory`.

## Tat Redis Khi Khong Dung

```powershell
docker compose -f docker-compose.redis.yml down
```

Neu muon giu data Redis trong volume nhung dung container, dung lenh tren la du.

Neu muon xoa luon volume data local:

```powershell
docker compose -f docker-compose.redis.yml down -v
```

## Cac Lenh Thuong Dung

```powershell
docker compose -f docker-compose.redis.yml up -d
docker compose -f docker-compose.redis.yml down
docker compose -f docker-compose.redis.yml logs -f redis
cd backend
npm run redis:check
```

## Loi Thuong Gap

### Docker Desktop khong start

Chay lai:

```powershell
wsl --update
wsl --shutdown
```

Sau do mo lai Docker Desktop.

### Backend van bao dung memory

Kiem tra 3 diem:

1. Docker co dang chay khong
2. Container Redis co dang chay khong
3. `REDIS_URL` trong [backend/.env](backend/.env) co dung `redis://127.0.0.1:6379` khong

Sau do chay lai:

```powershell
cd backend
npm run redis:check
```

### Port 6379 bi trung

Kiem tra service khac dang dung Redis hoac doi port trong [docker-compose.redis.yml](docker-compose.redis.yml), sau do cap nhat lai `REDIS_URL` trong [backend/.env](backend/.env).

## Ghi Chu

- Redis trong project nay dung cho cache backend va counter rate limit.
- Frontend cache neu co chi la lop bo sung de giam call API, khong thay the Redis backend.
- Production nen dung Redis that, khong nen phu thuoc memory fallback neu app chay nhieu instance.