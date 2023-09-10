const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// View 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 루트 경로 설정
app.get('/', (req, res) => {
  res.render('index'); // 'index.ejs' 를 사용
});

// 세션 및 데이터베이스 설정
const secretKey = crypto.randomBytes(32).toString('hex');
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '0916', // 환경 변수로 설정하는 것이 좋습니다.
  database: 'user',
});

// 데이터베이스 연결
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// 사용자 테이블 생성
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
  )
`, (err) => {
  if (err) {
    console.error('Error creating users table:', err);
  }
});

// 세션 미들웨어 설정
app.use(session({
  secret: secretKey,
  resave: false,
  saveUninitialized: true,
}));

// POST 요청 데이터 파싱을 위한 미들웨어
app.use(express.urlencoded({ extended: true }));

// 정적 파일 경로 설정 (CSS, 이미지 등)
app.use(express.static(path.join(__dirname, 'public')));

// 로그인 페이지 렌더링
app.get('/login', (req, res) => {
  res.render('login.ejs');
});

// 회원가입 요청 처리
app.post('/register', (req, res) => {
  const { userid, username, password } = req.body;

  // 중복 사용자 확인
  db.query('SELECT * FROM users WHERE userid = ?', [userid], (selectErr, selectResults) => {
    if (selectErr) {
      console.error('Error checking duplicate user:', selectErr);
      res.send('Registration failed');
      return;
    }

    if (selectResults.length > 0) {
      res.send('User already exists');
    } else {
      // 비밀번호를 안전하게 저장하기 위해 해싱 사용 추천
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

      // 사용자 등록
      db.query('INSERT INTO users (userid, username, password) VALUES (?, ?, ?)', [userid, username, hashedPassword], (insertErr) => {
        if (insertErr) {
          console.error('Error registering user:', insertErr);
          res.send('Registration failed');
          return;
        }
        res.send('Registration successful');
      });
    }
  });
});

// 로그인 요청 처리
app.post('/login', (req, res) => {
  const { userid, password } = req.body;
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  // 사용자 인증
  db.query('SELECT * FROM users WHERE userid = ? AND password = ?', [userid, hashedPassword], (err, results) => {
    if (err) {
      console.error('Error checking user credentials:', err);
      res.send('Login failed');
      return;
    }
    if (results.length > 0) {
      req.session.userId = results[0].id;
      req.session.username = results[0].username;
      res.redirect('/profile');
    } else {
      res.send('Login failed');
    }
  });
});
app.get('/profile', (req, res) => {
  const username = req.session.username;
  res.render('profile', { username });
});

db.query(`
  CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating posts table:', err);
  }
});

// 게시물 작성 페이지 렌더링
app.get('/createPost', (req, res) => {
  res.render('createPost.ejs');
});

// 게시물 작성 요청 처리
app.post('/createPost', (req, res) => {


  const { title, content } = req.body;
  const authorId = req.session.userId; // 현재 로그인한 사용자의 ID를 사용
  // 게시물을 데이터베이스에 삽입
  db.query('INSERT INTO posts (title, content, author_id) VALUES(?, ?, ?)', [title, content, authorId], (err, result) => {   
    if (err) {
      console.error('Error creating post:', err);
      res.send('Failed to create post');
      return;
    }
    
    res.redirect('/board');
  });
  
});

// 게시판 목록 페이지 렌더링
app.get('/board', (req, res) => {
  // 게시판 글 목록을 데이터베이스에서 가져오기
  db.query('SELECT * FROM posts', (err, results) => {
    if (err) {
      console.error('Error fetching posts:', err);
      res.send('Failed to fetch posts');
      return;
    }
    res.render('board', { posts: results }); // 게시판 목록 페이지로 데이터 전달
  });
});

// 개별 게시물 보기 페이지 렌더링
app.get('/board/:postId', (req, res) => {
  const postId = req.params.postId;

  // postId를 사용하여 해당 게시물을 데이터베이스에서 조회
  db.query('SELECT * FROM posts WHERE id = ?', [postId], (err, results) => {
    if (err) {
      console.error('Error fetching post:', err);
      res.send('Failed to fetch post');
      return;
    }
    const post = results[0];
    res.render('post', { post }); // 게시물 보기 페이지로 데이터 전달
  });
});

// 게시물 수정 페이지 렌더링
app.get('/editPost/:postId', (req, res) => {
  const postId = req.params.postId;

  // postId를 사용하여 해당 게시물을 데이터베이스에서 조회
  db.query('SELECT * FROM posts WHERE id = ?', [postId], (err, results) => {
    if (err) {
      console.error('Error fetching post:', err);
      res.send('Failed to fetch post');
      return;
    }
    
    const post = results[0];
    res.render('editPost', { post }); // 게시물 수정 페이지로 데이터 전달
  });
});

// 게시물 수정 요청 처리
app.post('/editPost/:postId', (req, res) => {
  const postId = req.params.postId;
  const { title, content } = req.body;

  // postId를 사용하여 해당 게시물을 데이터베이스에서 업데이트
  db.query('UPDATE posts SET title = ?, content = ? WHERE id = ?', [title, content, postId], (err, result) => {
    if (err) {
      console.error('Error updating post:', err);
      res.send('Failed to update post');
      return;
    }
    
    res.redirect('/board'); // 수정 후 게시판 목록 페이지로 리디렉션
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Session secret key: ${secretKey}`);
});

