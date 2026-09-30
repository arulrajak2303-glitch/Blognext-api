const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const app = require('../src/app');
const connectDB = require('../src/config/db');

let server;
let baseUrl;

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function recordTest(name, passed, details = '') {
  if (passed) {
    results.passed++;
    console.log(`  \x1b[32mPASS\x1b[0m - ${name}`);
  } else {
    results.failed++;
    console.log(`  \x1b[31mFAIL\x1b[0m - ${name}: ${details}`);
  }
  results.tests.push({ name, passed, details });
}

async function runTests() {
  console.log('====================================================');
  console.log(' STARTING BLOGNEST / CONTENTGEN BACKEND TEST SUITE ');
  console.log('====================================================');

  try {
    await connectDB();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  // Start server on an ephemeral/test port
  const TEST_PORT = 5098;
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });
  baseUrl = `http://localhost:${TEST_PORT}`;

  const timestamp = Date.now();
  const adminEmail = `admin_${timestamp}@test.com`;
  const editorEmail = `editor_${timestamp}@test.com`;
  const authorEmail = `author_${timestamp}@test.com`;
  const readerEmail = `reader_${timestamp}@test.com`;

  let adminToken, editorToken, authorToken, readerToken;
  let authorUserId, readerUserId;
  let testBlogId, testCategoryId, testTagId, testCommentId;

  try {
    // -------------------------------------------------------------
    // TEST 1: Health Check Endpoint
    // -------------------------------------------------------------
    console.log('\n[1] Health Check');
    try {
      const res = await axios.get(`${baseUrl}/api/health`);
      const pass = res.status === 200 && res.data.status === 'healthy' && res.data.database === 'connected';
      recordTest('GET /api/health returns healthy & database connected', pass);
    } catch (err) {
      recordTest('GET /api/health', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 2: User Registration (All 4 Roles)
    // -------------------------------------------------------------
    console.log('\n[2] User Registration');
    try {
      // Register Admin
      const adminRes = await axios.post(`${baseUrl}/api/auth/register`, {
        name: 'Admin User',
        email: adminEmail,
        password: 'Password123!',
        role: 'Admin',
      });
      adminToken = adminRes.data.token;
      recordTest('Register Admin user', adminRes.status === 201 && adminRes.data.user.role === 'Admin');

      // Register Editor
      const editorRes = await axios.post(`${baseUrl}/api/auth/register`, {
        name: 'Editor User',
        email: editorEmail,
        password: 'Password123!',
        role: 'Editor',
      });
      editorToken = editorRes.data.token;
      recordTest('Register Editor user', editorRes.status === 201 && editorRes.data.user.role === 'Editor');

      // Register Author
      const authorRes = await axios.post(`${baseUrl}/api/auth/register`, {
        name: 'Author User',
        email: authorEmail,
        password: 'Password123!',
        role: 'Author',
      });
      authorToken = authorRes.data.token;
      authorUserId = authorRes.data.user.id;
      recordTest('Register Author user', authorRes.status === 201 && authorRes.data.user.role === 'Author');

      // Register Reader (Default role)
      const readerRes = await axios.post(`${baseUrl}/api/auth/register`, {
        name: 'Reader User',
        email: readerEmail,
        password: 'Password123!',
      });
      readerToken = readerRes.data.token;
      readerUserId = readerRes.data.user.id;
      recordTest('Register Reader user (default role)', readerRes.status === 201 && readerRes.data.user.role === 'Reader');

      // Duplicate registration should fail
      try {
        await axios.post(`${baseUrl}/api/auth/register`, {
          name: 'Duplicate',
          email: adminEmail,
          password: 'Password123!',
        });
        recordTest('Reject duplicate email registration', false, 'Should have failed with 400');
      } catch (dupErr) {
        recordTest('Reject duplicate email registration with 400', dupErr.response && dupErr.response.status === 400);
      }
    } catch (err) {
      recordTest('User Registration', false, err.response ? JSON.stringify(err.response.data) : err.message);
    }

    // -------------------------------------------------------------
    // TEST 3: User Login & JWT Generation
    // -------------------------------------------------------------
    console.log('\n[3] User Login & JWT');
    try {
      const loginRes = await axios.post(`${baseUrl}/api/auth/login`, {
        email: authorEmail,
        password: 'Password123!',
      });
      const pass = loginRes.status === 200 && !!loginRes.data.token && loginRes.data.user.email === authorEmail;
      recordTest('POST /api/auth/login succeeds and returns safe user + token', pass);

      // Invalid password check
      try {
        await axios.post(`${baseUrl}/api/auth/login`, {
          email: authorEmail,
          password: 'WrongPassword!',
        });
        recordTest('Reject invalid password with 401', false, 'Should have failed');
      } catch (loginErr) {
        recordTest('Reject invalid password with 401', loginErr.response && loginErr.response.status === 401);
      }
    } catch (err) {
      recordTest('User Login', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 4: Protected Profile & Token Authentication
    // -------------------------------------------------------------
    console.log('\n[4] Protected Routes & JWT Verification');
    try {
      // Valid token
      const profileRes = await axios.get(`${baseUrl}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${authorToken}` },
      });
      recordTest('GET /api/auth/profile returns user details with valid JWT', profileRes.status === 200 && profileRes.data.email === authorEmail);

      // Missing token
      try {
        await axios.get(`${baseUrl}/api/auth/profile`);
        recordTest('Reject request without token with 401', false);
      } catch (authErr) {
        recordTest('Reject request without token with 401', authErr.response && authErr.response.status === 401);
      }

      // Invalid token
      try {
        await axios.get(`${baseUrl}/api/auth/profile`, {
          headers: { Authorization: 'Bearer invalid.token.value' },
        });
        recordTest('Reject request with invalid token with 401', false);
      } catch (authErr) {
        recordTest('Reject request with invalid token with 401', authErr.response && authErr.response.status === 401);
      }
    } catch (err) {
      recordTest('Protected Profile', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 5: Role-Based Authorization
    // -------------------------------------------------------------
    console.log('\n[5] Role-Based Authorization Checks');
    try {
      // Reader attempts to create blog (Forbidden)
      try {
        await axios.post(
          `${baseUrl}/api/blogs`,
          { title: 'Reader Blog', content: 'Reader Content', category: 'General' },
          { headers: { Authorization: `Bearer ${readerToken}` } }
        );
        recordTest('Reject Reader creating blog with 403 Forbidden', false);
      } catch (roleErr) {
        recordTest('Reject Reader creating blog with 403 Forbidden', roleErr.response && roleErr.response.status === 403);
      }

      // Reader attempts to access Admin user list (Forbidden)
      try {
        await axios.get(`${baseUrl}/api/auth/users`, {
          headers: { Authorization: `Bearer ${readerToken}` },
        });
        recordTest('Reject non-Admin accessing /api/auth/users with 403', false);
      } catch (roleErr) {
        recordTest('Reject non-Admin accessing /api/auth/users with 403', roleErr.response && roleErr.response.status === 403);
      }

      // Admin accesses user list (Allowed)
      const adminUsersRes = await axios.get(`${baseUrl}/api/auth/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordTest('Admin successfully accesses /api/auth/users', adminUsersRes.status === 200 && Array.isArray(adminUsersRes.data));
    } catch (err) {
      recordTest('Role Authorization', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 6: Category Management
    // -------------------------------------------------------------
    console.log('\n[6] Categories CRUD');
    try {
      // Reader cannot create category
      try {
        await axios.post(
          `${baseUrl}/api/categories`,
          { name: `Tech_${timestamp}`, description: 'Technology blogs' },
          { headers: { Authorization: `Bearer ${readerToken}` } }
        );
        recordTest('Reader cannot create category (403)', false);
      } catch (catErr) {
        recordTest('Reader cannot create category (403)', catErr.response && catErr.response.status === 403);
      }

      // Editor creates category
      const createCatRes = await axios.post(
        `${baseUrl}/api/categories`,
        { name: `Technology_${timestamp}`, description: 'All tech posts' },
        { headers: { Authorization: `Bearer ${editorToken}` } }
      );
      testCategoryId = createCatRes.data._id;
      recordTest('Editor creates category (201)', createCatRes.status === 201 && !!testCategoryId);

      // Public can list categories
      const listCatRes = await axios.get(`${baseUrl}/api/categories`);
      recordTest('Public / Reader can fetch categories', listCatRes.status === 200 && listCatRes.data.length > 0);
    } catch (err) {
      recordTest('Category operations', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 7: Tag Management
    // -------------------------------------------------------------
    console.log('\n[7] Tags CRUD');
    try {
      const createTagRes = await axios.post(
        `${baseUrl}/api/tags`,
        { name: `NodeJS_${timestamp}` },
        { headers: { Authorization: `Bearer ${authorToken}` } }
      );
      testTagId = createTagRes.data._id;
      recordTest('Author creates tag (201)', createTagRes.status === 201 && !!testTagId);

      const listTagRes = await axios.get(`${baseUrl}/api/tags`);
      recordTest('Fetch all tags', listTagRes.status === 200 && listTagRes.data.length > 0);
    } catch (err) {
      recordTest('Tag operations', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 8: Blog CRUD & Status Lifecycle
    // -------------------------------------------------------------
    console.log('\n[8] Blog / Post CRUD');
    try {
      // Author creates blog
      const createBlogRes = await axios.post(
        `${baseUrl}/api/blogs`,
        {
          title: 'Understanding Modern Web Architectures',
          content: 'Modern web architectures decouple business logic from delivery systems.',
          category: `Technology_${timestamp}`,
          tags: [`NodeJS_${timestamp}`, 'Architecture'],
          photo: 'https://example.com/cover.jpg',
          status: 'Published',
        },
        { headers: { Authorization: `Bearer ${authorToken}` } }
      );
      testBlogId = createBlogRes.data._id;
      recordTest('Author creates blog (POST /api/blogs)', createBlogRes.status === 201 && !!testBlogId);

      // Fetch all blogs
      const allBlogsRes = await axios.get(`${baseUrl}/api/blogs`);
      recordTest('Fetch all blogs (GET /api/blogs)', allBlogsRes.status === 200 && allBlogsRes.data.length > 0);

      // Fetch blog by ID
      const singleBlogRes = await axios.get(`${baseUrl}/api/blogs/${testBlogId}`);
      recordTest('Fetch single blog by ID (GET /api/blogs/:id)', singleBlogRes.status === 200 && singleBlogRes.data.title === 'Understanding Modern Web Architectures');

      // Update blog by Author
      const updateBlogRes = await axios.put(
        `${baseUrl}/api/blogs/${testBlogId}`,
        {
          title: 'Understanding Modern Web Architectures (Updated)',
        },
        { headers: { Authorization: `Bearer ${authorToken}` } }
      );
      recordTest('Author updates own blog (PUT /api/blogs/:id)', updateBlogRes.status === 200 && updateBlogRes.data.title.includes('Updated'));

      // Another user (Reader) cannot update this blog
      try {
        await axios.put(
          `${baseUrl}/api/blogs/${testBlogId}`,
          { title: 'Hacked Title' },
          { headers: { Authorization: `Bearer ${readerToken}` } }
        );
        recordTest('Non-author reader cannot update blog (403)', false);
      } catch (putErr) {
        recordTest('Non-author reader cannot update blog (403)', putErr.response && putErr.response.status === 403);
      }

      // Like blog
      const likeRes = await axios.post(
        `${baseUrl}/api/blogs/${testBlogId}/like`,
        {},
        { headers: { Authorization: `Bearer ${readerToken}` } }
      );
      recordTest('User can like blog (POST /api/blogs/:id/like)', likeRes.status === 200 && likeRes.data.likes >= 1);
    } catch (err) {
      recordTest('Blog CRUD operations', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 9: Search and Filtering
    // -------------------------------------------------------------
    console.log('\n[9] Search and Filtering');
    try {
      // Search via /api/blogs/search?q=Modern
      const searchRes = await axios.get(`${baseUrl}/api/blogs/search?q=Modern`);
      recordTest('GET /api/blogs/search?q=Modern returns matching blogs', searchRes.status === 200 && searchRes.data.length > 0);

      // Filter by category
      const catFilterRes = await axios.get(`${baseUrl}/api/blogs?category=Technology_${timestamp}`);
      recordTest('GET /api/blogs?category=... filters properly', catFilterRes.status === 200 && catFilterRes.data.length > 0);
    } catch (err) {
      recordTest('Search and filtering', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 10: Comments and Comment Moderation
    // -------------------------------------------------------------
    console.log('\n[10] Comments and Moderation');
    try {
      // Reader creates comment on blog
      const commentRes = await axios.post(
        `${baseUrl}/api/blogs/${testBlogId}/comments`,
        { content: 'Great insights on backend decoupled architecture!' },
        { headers: { Authorization: `Bearer ${readerToken}` } }
      );
      testCommentId = commentRes.data._id;
      recordTest('Reader comments on blog (POST /api/blogs/:id/comments)', commentRes.status === 201 && !!testCommentId);

      // Fetch comments for blog
      const getCommentsRes = await axios.get(`${baseUrl}/api/blogs/${testBlogId}/comments`);
      recordTest('GET /api/blogs/:id/comments returns comments', getCommentsRes.status === 200 && getCommentsRes.data.length > 0);

      // Editor moderates comment to 'approved'
      const modRes = await axios.put(
        `${baseUrl}/api/comments/${testCommentId}/moderate`,
        { status: 'approved' },
        { headers: { Authorization: `Bearer ${editorToken}` } }
      );
      recordTest('Editor moderates comment status (PUT /api/comments/:id/moderate)', modRes.status === 200 && modRes.data.comment.status === 'approved');

      // Reader cannot moderate comment
      try {
        await axios.put(
          `${baseUrl}/api/comments/${testCommentId}/moderate`,
          { status: 'spam' },
          { headers: { Authorization: `Bearer ${readerToken}` } }
        );
        recordTest('Reader cannot moderate comments (403)', false);
      } catch (modErr) {
        recordTest('Reader cannot moderate comments (403)', modErr.response && modErr.response.status === 403);
      }
    } catch (err) {
      recordTest('Comments operations', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 11: Real Google Gemini AI Integration
    // -------------------------------------------------------------
    console.log('\n[11] Google Gemini AI Features');
    try {
      // 1. AI Blog Generation
      console.log('  Testing POST /api/ai/generate-blog with real Gemini API...');
      const genBlogRes = await axios.post(
        `${baseUrl}/api/ai/generate-blog`,
        {
          topic: 'Artificial Intelligence in Education',
          category: 'Education',
        },
        { headers: { Authorization: `Bearer ${authorToken}` } }
      );
      const genPassed = genBlogRes.status === 201 && genBlogRes.data.title && genBlogRes.data.content && genBlogRes.data.content.length > 50;
      recordTest('POST /api/ai/generate-blog creates AI blog using real Gemini', genPassed);

      // 2. AI Blog Summarization
      console.log('  Testing POST /api/ai/summarize with real Gemini API...');
      const sampleText = 'Artificial Intelligence is revolutionizing classrooms by personalizing learning paths, automating grading tasks for teachers, providing 24/7 tutoring assistance to students worldwide, and facilitating interactive study materials tailored to each student pace.';
      const sumRes = await axios.post(`${baseUrl}/api/ai/summarize`, {
        content: sampleText,
      });
      const sumPassed = sumRes.status === 200 && sumRes.data.summary && sumRes.data.summary.length > 10;
      recordTest('POST /api/ai/summarize generates concise summary using real Gemini', sumPassed);
    } catch (err) {
      recordTest('Gemini AI Endpoints', false, err.response ? JSON.stringify(err.response.data) : err.message);
    }

    // -------------------------------------------------------------
    // TEST 12: Blog Deletion & Mongoose 7 Fix
    // -------------------------------------------------------------
    console.log('\n[12] Blog Deletion (Mongoose 7 findByIdAndDelete verification)');
    try {
      const delRes = await axios.delete(`${baseUrl}/api/blogs/${testBlogId}`, {
        headers: { Authorization: `Bearer ${authorToken}` },
      });
      recordTest('Author deletes blog successfully (DELETE /api/blogs/:id)', delRes.status === 200);

      // Verify it's gone
      try {
        await axios.get(`${baseUrl}/api/blogs/${testBlogId}`);
        recordTest('Deleted blog returns 404', false);
      } catch (nfErr) {
        recordTest('Deleted blog returns 404', nfErr.response && nfErr.response.status === 404);
      }
    } catch (err) {
      recordTest('Blog Deletion', false, err.message);
    }

  } finally {
    // Teardown
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();

    console.log('\n====================================================');
    console.log(` TEST SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED`);
    console.log('====================================================');

    setTimeout(() => {
      process.exit(results.failed === 0 ? 0 : 1);
    }, 200);
  }
}

runTests();
