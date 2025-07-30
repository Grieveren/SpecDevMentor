# CodeMentor AI - UAT Testing Guide

This guide provides comprehensive User Acceptance Testing (UAT) scenarios for the CodeMentor AI platform.

## Pre-Testing Setup

1. **Start the Production Environment**

   ```bash
   ./scripts/start-production-local.sh
   ```

2. **Verify All Services Are Running**

   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001/health
   - Database: `docker exec codementor-postgres pg_isready -U codementor -d codementor_ai`

3. **Create Test Accounts**
   - Admin user: admin@codementor-ai.com
   - Team lead: teamlead@codementor-ai.com
   - Developer: developer@codementor-ai.com
   - Student: student@codementor-ai.com

## UAT Test Scenarios

### 1. Authentication & User Management

#### Test Case 1.1: User Registration

**Objective**: Verify new users can register successfully

**Steps**:

1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Fill in registration form:
   - Name: "Test User"
   - Email: "testuser@example.com"
   - Password: "SecurePass123!"
   - Confirm Password: "SecurePass123!"
4. Select role: "Developer"
5. Click "Create Account"

**Expected Results**:

- User account created successfully
- Redirect to dashboard
- Welcome message displayed
- User profile shows correct information

#### Test Case 1.2: User Login

**Objective**: Verify existing users can login

**Steps**:

1. Navigate to login page
2. Enter credentials:
   - Email: "testuser@example.com"
   - Password: "SecurePass123!"
3. Click "Sign In"

**Expected Results**:

- Successful login
- Redirect to dashboard
- User session established
- Navigation shows user name

#### Test Case 1.3: Password Reset

**Objective**: Verify password reset functionality

**Steps**:

1. Click "Forgot Password" on login page
2. Enter email: "testuser@example.com"
3. Check for reset instructions
4. Follow reset process

**Expected Results**:

- Reset email sent (check logs)
- Reset link works
- New password accepted
- Can login with new password

### 2. Specification Project Management

#### Test Case 2.1: Create New Project

**Objective**: Verify users can create specification projects

**Steps**:

1. Login as Developer
2. Click "New Project" button
3. Fill in project details:
   - Name: "E-commerce Platform"
   - Description: "Online shopping platform with user management"
   - Template: "Web Application"
4. Click "Create Project"

**Expected Results**:

- Project created successfully
- Redirected to project dashboard
- Project appears in project list
- Initial documents created for all phases

#### Test Case 2.2: Project Team Management

**Objective**: Verify team member management

**Steps**:

1. Open existing project
2. Navigate to "Team" section
3. Click "Add Member"
4. Search for user: "student@codementor-ai.com"
5. Select role: "Member"
6. Click "Add"

**Expected Results**:

- Team member added successfully
- Member appears in team list
- Member receives notification
- Member can access project

### 3. Specification Workflow

#### Test Case 3.1: Requirements Phase

**Objective**: Verify requirements creation and validation

**Steps**:

1. Open project in Requirements phase
2. Edit requirements document:

   ```markdown
   # Requirements Document

   ## User Authentication

   **User Story**: As a customer, I want to create an account, so that I can save my preferences and order history.

   ### Acceptance Criteria

   1. WHEN a user provides valid email and password THEN the system SHALL create a new account
   2. WHEN a user provides an existing email THEN the system SHALL display an error message
   3. WHEN a user provides invalid email format THEN the system SHALL display validation error
   ```

3. Save document
4. Request AI review
5. Apply suggested improvements

**Expected Results**:

- Document saves automatically
- AI review provides feedback
- EARS format validation works
- Suggestions can be applied
- Quality score displayed

#### Test Case 3.2: Phase Transition

**Objective**: Verify workflow phase transitions

**Steps**:

1. Complete requirements phase
2. Click "Proceed to Design"
3. Confirm phase transition
4. Verify design phase access

**Expected Results**:

- Phase transition successful
- Design document accessible
- Requirements locked for editing
- Progress indicator updated

#### Test Case 3.3: Design Phase

**Objective**: Verify design document creation

**Steps**:

1. Navigate to Design phase
2. Create system architecture:

   ````markdown
   # System Design

   ## Architecture Overview

   - Frontend: React with TypeScript
   - Backend: Node.js with Express
   - Database: PostgreSQL
   - Authentication: JWT tokens

   ## Component Diagram

   ```mermaid
   graph TD
       A[Frontend] --> B[API Gateway]
       B --> C[Auth Service]
       B --> D[User Service]
       C --> E[Database]
       D --> E
   ```
   ````

3. Save and request AI review

**Expected Results**:

- Design document created
- Mermaid diagrams render correctly
- AI provides architecture feedback
- Technical completeness validated

#### Test Case 3.4: Tasks Phase

**Objective**: Verify implementation task breakdown

**Steps**:

1. Transition to Tasks phase
2. Create task breakdown:

   ```markdown
   # Implementation Tasks

   - [ ] 1. Setup project structure

     - Initialize React application
     - Configure TypeScript
     - Setup testing framework

   - [ ] 2. Implement authentication
     - [ ] 2.1 Create login component
     - [ ] 2.2 Implement JWT handling
     - [ ] 2.3 Add protected routes
   ```

3. Save and validate

**Expected Results**:

- Task list created
- Checkboxes functional
- Task dependencies clear
- Effort estimation provided

### 4. Real-time Collaboration

#### Test Case 4.1: Collaborative Editing

**Objective**: Verify multiple users can edit simultaneously

**Steps**:

1. Open same document in two browser windows
2. Login as different users in each window
3. Edit document simultaneously
4. Verify changes sync in real-time

**Expected Results**:

- Changes appear in real-time
- No conflicts or data loss
- User cursors visible
- Operational transformation works

#### Test Case 4.2: Comment System

**Objective**: Verify commenting and discussion features

**Steps**:

1. Select text in document
2. Click "Add Comment"
3. Enter comment: "This requirement needs clarification"
4. Submit comment
5. Reply to comment from another user

**Expected Results**:

- Comment thread created
- Comments appear in real-time
- Notifications sent to team
- Comment resolution works

### 5. AI-Powered Reviews

#### Test Case 5.1: Specification Analysis

**Objective**: Verify AI review functionality

**Steps**:

1. Create incomplete requirements document
2. Click "Request AI Review"
3. Wait for analysis completion
4. Review suggestions and feedback

**Expected Results**:

- AI analysis completes within 30 seconds
- Quality score provided (0-100)
- Specific suggestions given
- Missing elements identified

#### Test Case 5.2: EARS Format Validation

**Objective**: Verify EARS format checking

**Steps**:

1. Write requirements without EARS format:
   ```markdown
   The system should allow users to login
   Users need to be able to reset passwords
   ```
2. Request AI review
3. Check validation feedback

**Expected Results**:

- EARS format violations detected
- Suggestions for proper format provided
- Examples of correct format shown
- Quality score reflects format issues

### 6. Code Execution & Validation

#### Test Case 6.1: Code Execution

**Objective**: Verify secure code execution

**Steps**:

1. Navigate to code execution interface
2. Select language: JavaScript
3. Enter test code:

   ```javascript
   function validateEmail(email) {
     const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     return regex.test(email);
   }

   console.log(validateEmail('test@example.com'));
   console.log(validateEmail('invalid-email'));
   ```

4. Click "Run Code"

**Expected Results**:

- Code executes in secure sandbox
- Output displayed correctly
- No security vulnerabilities
- Execution time within limits

#### Test Case 6.2: Specification Compliance

**Objective**: Verify code-to-spec validation

**Steps**:

1. Upload code implementation
2. Run compliance check against requirements
3. Review compliance report

**Expected Results**:

- Compliance score calculated
- Missing implementations identified
- Code quality metrics provided
- Recommendations for improvement

### 7. Learning System

#### Test Case 7.1: Interactive Lessons

**Objective**: Verify learning module functionality

**Steps**:

1. Navigate to Learning section
2. Select "Requirements Engineering Basics"
3. Complete lesson modules
4. Take practice exercises

**Expected Results**:

- Lessons load correctly
- Interactive elements work
- Progress tracked accurately
- Exercises provide feedback

#### Test Case 7.2: Skill Assessment

**Objective**: Verify skill tracking and assessment

**Steps**:

1. Complete multiple learning modules
2. Take skill assessment
3. Review progress dashboard

**Expected Results**:

- Skills accurately assessed
- Progress visualized clearly
- Recommendations provided
- Achievements unlocked

### 8. Analytics & Reporting

#### Test Case 8.1: Team Analytics

**Objective**: Verify analytics dashboard

**Steps**:

1. Login as Team Lead
2. Navigate to Analytics
3. Select date range: Last 30 days
4. Review team performance metrics

**Expected Results**:

- Charts render correctly
- Data accurate and up-to-date
- Filters work properly
- Export functionality available

#### Test Case 8.2: Individual Progress

**Objective**: Verify personal analytics

**Steps**:

1. Login as Developer
2. View personal dashboard
3. Check progress metrics
4. Review skill development

**Expected Results**:

- Personal metrics displayed
- Progress trends visible
- Goals and achievements shown
- Recommendations provided

### 9. File Management

#### Test Case 9.1: File Upload

**Objective**: Verify file attachment functionality

**Steps**:

1. Open specification document
2. Click "Attach File"
3. Upload image file (< 5MB)
4. Insert into document

**Expected Results**:

- File uploads successfully
- Image displays in document
- File size limits enforced
- Security scanning works

### 10. Search & Navigation

#### Test Case 10.1: Global Search

**Objective**: Verify search functionality

**Steps**:

1. Use global search bar
2. Search for: "authentication"
3. Filter by: Projects
4. Review search results

**Expected Results**:

- Relevant results returned
- Search highlights work
- Filters function correctly
- Results link to correct content

## Performance Testing

### Load Testing Scenarios

#### Test Case P.1: Concurrent Users

**Objective**: Verify system handles multiple users

**Steps**:

1. Simulate 50 concurrent users
2. Perform various operations simultaneously
3. Monitor response times and errors

**Expected Results**:

- Response times < 2 seconds
- No errors or timeouts
- Database performance stable
- Memory usage within limits

#### Test Case P.2: Large Document Handling

**Objective**: Verify large document performance

**Steps**:

1. Create document with 10,000+ words
2. Perform real-time editing
3. Request AI review
4. Monitor performance

**Expected Results**:

- Editing remains responsive
- AI review completes successfully
- No memory leaks
- Collaboration still works

## Security Testing

### Security Test Scenarios

#### Test Case S.1: Input Validation

**Objective**: Verify input sanitization

**Steps**:

1. Attempt XSS injection in forms
2. Try SQL injection in search
3. Upload malicious files
4. Test API endpoints with invalid data

**Expected Results**:

- All malicious input blocked
- Error messages don't reveal system info
- File uploads properly scanned
- API returns appropriate errors

#### Test Case S.2: Authentication Security

**Objective**: Verify auth security measures

**Steps**:

1. Test password strength requirements
2. Verify session timeout
3. Test JWT token validation
4. Check rate limiting

**Expected Results**:

- Weak passwords rejected
- Sessions expire properly
- Invalid tokens rejected
- Rate limiting prevents abuse

## Accessibility Testing

### Accessibility Test Scenarios

#### Test Case A.1: Keyboard Navigation

**Objective**: Verify keyboard accessibility

**Steps**:

1. Navigate entire application using only keyboard
2. Test Tab, Enter, Escape keys
3. Verify focus indicators
4. Test screen reader compatibility

**Expected Results**:

- All features accessible via keyboard
- Focus indicators clearly visible
- Logical tab order maintained
- Screen reader announces content

## Browser Compatibility

### Cross-Browser Testing

#### Test Case B.1: Browser Support

**Objective**: Verify cross-browser compatibility

**Browsers to Test**:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Expected Results**:

- All features work consistently
- UI renders correctly
- Performance acceptable
- No JavaScript errors

## Mobile Responsiveness

### Mobile Testing Scenarios

#### Test Case M.1: Mobile Interface

**Objective**: Verify mobile responsiveness

**Steps**:

1. Test on various screen sizes
2. Verify touch interactions
3. Check mobile navigation
4. Test performance on mobile

**Expected Results**:

- Interface adapts to screen size
- Touch targets appropriately sized
- Navigation works on mobile
- Performance remains acceptable

## Test Data Cleanup

After completing UAT testing:

1. **Reset Test Environment**

   ```bash
   ./scripts/reset-local-environment.sh
   ```

2. **Document Issues Found**

   - Create issue tickets for bugs
   - Document performance concerns
   - Note usability improvements

3. **Generate Test Report**
   - Summarize test results
   - Include screenshots of issues
   - Provide recommendations

## Troubleshooting Common Issues

### Issue: Services Won't Start

**Solution**:

- Check port availability
- Verify Docker is running
- Check environment variables

### Issue: Database Connection Failed

**Solution**:

- Verify PostgreSQL container is running
- Check DATABASE_URL configuration
- Restart database service

### Issue: AI Reviews Not Working

**Solution**:

- Verify OPENAI_API_KEY is set
- Check API quota limits
- Review server logs for errors

### Issue: Real-time Features Not Working

**Solution**:

- Check WebSocket connection
- Verify Redis is running
- Check browser console for errors

For additional support, see LOCAL_PRODUCTION_SETUP.md or check the logs in the `logs/` directory.
