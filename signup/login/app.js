const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const mysql = require('mysql2');
const path = require('path'); // path 모듈 추가

const app = express();
const PORT = 8000;

// 랜덤한 세션 비밀 키 생성
const secretKey = crypto.randomBytes(32).toString('hex');

// MySQL 데이터베이스 연결 설정
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '0916', // 비밀번호를 환경 변수로 설정
  database: 'user',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// MySQL 테이블 생성
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
  )
`, (err) => {
  if (err) {
    console.error('Error creating users table:', err);
  }
});

app.use(session({
  secret: secretKey,
  resave: false,
  saveUninitialized: true,
}));

app.use(express.urlencoded({ extended: true }));

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  // MySQL에 사용자 추가
  db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err) => {
    if (err) {
      console.error('Error registering user:', err);
      res.send('Registration failed');
      return;
    }
    res.send('Registration successful');
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // MySQL에서 사용자 확인
  db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
    if (err) {
      console.error('Error checking user credentials:', err);
      res.send('Login failed');
      return;
    }
    if (results.length > 0) {
      req.session.userId = results[0].id;
      res.send('Login successful');
    } else {
      res.send('Login failed');
    }
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Session secret key: ${secretKey}`);
});
