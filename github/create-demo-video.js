#!/usr/bin/env node

/**
 * Automated Demo Video Creator
 * Creates a professional demo video combining PowerPoint slides with app recordings
 */

const fs = require('fs');
const path = require('path');

// Video creation configuration
const config = {
  outputDir: './demo-video-output',
  slides: [
    {
      name: 'title',
      url: 'http://localhost:5000/demo-presentation.html',
      duration: 10000,
      description: 'Title slide with branding'
    },
    {
      name: 'ai-content-demo',
      url: 'http://localhost:5000/',
      duration: 35000,
      description: 'AI Content Generation demo',
      actions: [
        'navigate to AI content',
        'enter property prompt',
        'add keywords',
        'generate content'
      ]
    },
    {
      name: 'social-media-demo',
      url: 'http://localhost:5000/social-media',
      duration: 35000,
      description: 'Social Media posting with YouTube upload',
      actions: [
        'select platforms',
        'upload video',
        'post content'
      ]
    },
    {
      name: 'seo-demo',
      url: 'http://localhost:5000/',
      duration: 20000,
      description: 'SEO optimization demo',
      actions: [
        'show SEO metrics',
        'add keywords'
      ]
    },
    {
      name: 'cta',
      url: 'http://localhost:5000/demo-presentation.html',
      duration: 15000,
      description: 'Call to action slide'
    }
  ]
};

// Create output directory
function createOutputDir() {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
    console.log(`✅ Created output directory: ${config.outputDir}`);
  }
}

// Generate HTML video player for preview
function createVideoPlayer() {
  const playerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real Estate AI Dashboard - Demo Video</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            text-align: center;
        }
        
        .video-container {
            max-width: 1200px;
            margin: 0 auto;
            background: #2a2a2a;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        
        .subtitle {
            color: #a0aec0;
            margin-bottom: 30px;
            font-size: 1.2em;
        }
        
        .demo-video {
            width: 100%;
            max-width: 1080px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        
        .video-controls {
            margin-top: 20px;
            display: flex;
            justify-content: center;
            gap: 15px;
        }
        
        .control-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .control-btn:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        
        .video-info {
            margin-top: 30px;
            text-align: left;
            background: #333;
            padding: 20px;
            border-radius: 10px;
        }
        
        .video-info h3 {
            color: #667eea;
            margin-bottom: 15px;
        }
        
        .timeline {
            list-style: none;
            padding: 0;
        }
        
        .timeline li {
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #444;
        }
        
        .timeline li:last-child {
            border-bottom: none;
        }
        
        .timestamp {
            color: #ff6b6b;
            font-weight: bold;
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div class="video-container">
        <h1>🏠 Real Estate AI Dashboard</h1>
        <p class="subtitle">Professional Demo Video - Automated Marketing Platform</p>
        
        <video class="demo-video" controls poster="demo-thumbnail.png">
            <source src="real-estate-ai-demo.mp4" type="video/mp4">
            <source src="real-estate-ai-demo.webm" type="video/webm">
            Your browser does not support the video tag.
        </video>
        
        <div class="video-controls">
            <button class="control-btn" onclick="restartVideo()">🔄 Restart</button>
            <button class="control-btn" onclick="downloadVideo()">⬇️ Download</button>
            <button class="control-btn" onclick="shareVideo()">📤 Share</button>
        </div>
        
        <div class="video-info">
            <h3>📋 Video Timeline</h3>
            <ul class="timeline">
                <li><span class="timestamp">0:00-0:10</span> Title & Value Proposition</li>
                <li><span class="timestamp">0:10-0:45</span> AI Content Generation Demo</li>
                <li><span class="timestamp">0:45-1:20</span> Social Media & YouTube Upload</li>
                <li><span class="timestamp">1:20-1:40</span> SEO Optimization Tools</li>
                <li><span class="timestamp">1:40-2:00</span> Analytics & Calendar</li>
                <li><span class="timestamp">2:00-2:15</span> Call to Action</li>
            </ul>
            
            <h3>🎯 Key Features Demonstrated</h3>
            <ul style="list-style-type: disc; margin-left: 20px;">
                <li>AI-powered content generation for real estate</li>
                <li>Multi-platform social media posting</li>
                <li>Direct YouTube video upload functionality</li>
                <li>Local SEO optimization for Omaha market</li>
                <li>Content calendar and analytics dashboard</li>
                <li>Complete marketing automation workflow</li>
            </ul>
        </div>
    </div>

    <script>
        const video = document.querySelector('.demo-video');
        
        function restartVideo() {
            video.currentTime = 0;
            video.play();
        }
        
        function downloadVideo() {
            const link = document.createElement('a');
            link.href = 'real-estate-ai-demo.mp4';
            link.download = 'real-estate-ai-dashboard-demo.mp4';
            link.click();
        }
        
        function shareVideo() {
            if (navigator.share) {
                navigator.share({
                    title: 'Real Estate AI Dashboard Demo',
                    text: 'Check out this amazing AI-powered real estate marketing platform!',
                    url: window.location.href
                });
            } else {
                // Fallback for browsers that don't support Web Share API
                navigator.clipboard.writeText(window.location.href);
                alert('Video link copied to clipboard!');
            }
        }
        
        // Auto-play when page loads (muted to comply with browser policies)
        video.muted = true;
        video.play().then(() => {
            // Unmute after starting
            setTimeout(() => {
                video.muted = false;
            }, 1000);
        }).catch(console.log);
    </script>
</body>
</html>`;

  fs.writeFileSync(path.join(config.outputDir, 'demo-player.html'), playerHtml);
  console.log('✅ Created video player: demo-player.html');
}

// Create animated video using CSS animations and Canvas
function createAnimatedDemo() {
  const animatedDemoHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real Estate AI Demo - Animated</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            overflow: hidden;
            height: 100vh;
        }
        
        .demo-container {
            width: 100vw;
            height: 100vh;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .demo-frame {
            width: 1200px;
            height: 675px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
        }
        
        .scene {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            opacity: 0;
            transform: translateX(100px);
            transition: all 1s ease-in-out;
        }
        
        .scene.active {
            opacity: 1;
            transform: translateX(0);
        }
        
        .scene.exiting {
            opacity: 0;
            transform: translateX(-100px);
        }
        
        /* Title Scene */
        .title-scene {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 60px;
        }
        
        .title-scene h1 {
            font-size: 48px;
            margin-bottom: 20px;
            animation: slideInUp 1s ease-out;
        }
        
        .title-scene .subtitle {
            font-size: 24px;
            margin-bottom: 40px;
            animation: slideInUp 1s ease-out 0.3s both;
        }
        
        .features-showcase {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 40px;
            animation: slideInUp 1s ease-out 0.6s both;
        }
        
        .feature-item {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            font-size: 18px;
        }
        
        /* App Demo Scenes */
        .app-scene {
            background: #f7fafc;
            padding: 0;
            display: flex;
            flex-direction: column;
        }
        
        .app-header {
            background: white;
            padding: 20px 40px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: between;
        }
        
        .app-title {
            font-size: 24px;
            font-weight: bold;
            color: #2d3748;
        }
        
        .app-content {
            flex: 1;
            padding: 40px;
            display: flex;
            gap: 30px;
        }
        
        .sidebar-demo {
            width: 250px;
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .main-demo {
            flex: 1;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .demo-action {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            margin: 10px 0;
            animation: pulse 2s infinite;
        }
        
        .typing-animation {
            border-right: 2px solid #667eea;
            animation: typing 3s steps(40) 1s both, blink 1s infinite;
        }
        
        /* CTA Scene */
        .cta-scene {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 60px;
        }
        
        .cta-scene h1 {
            font-size: 36px;
            margin-bottom: 30px;
        }
        
        .benefits-list {
            list-style: none;
            padding: 0;
            margin: 30px 0;
        }
        
        .benefits-list li {
            margin: 15px 0;
            font-size: 20px;
            animation: slideInLeft 0.8s ease-out var(--delay) both;
        }
        
        .benefits-list li:nth-child(1) { --delay: 0.2s; }
        .benefits-list li:nth-child(2) { --delay: 0.4s; }
        .benefits-list li:nth-child(3) { --delay: 0.6s; }
        .benefits-list li:nth-child(4) { --delay: 0.8s; }
        
        .contact-box {
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 20px;
            margin-top: 30px;
            backdrop-filter: blur(10px);
        }
        
        /* Progress bar */
        .progress-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            height: 4px;
            background: #ff6b6b;
            transition: width 1s ease-in-out;
            z-index: 1000;
        }
        
        /* Animations */
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes slideInLeft {
            from {
                opacity: 0;
                transform: translateX(-50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.05);
            }
        }
        
        @keyframes typing {
            from {
                width: 0;
            }
            to {
                width: 100%;
            }
        }
        
        @keyframes blink {
            0%, 50% {
                border-color: transparent;
            }
            51%, 100% {
                border-color: #667eea;
            }
        }
    </style>
</head>
<body>
    <div class="demo-container">
        <div class="demo-frame">
            <!-- Scene 1: Title -->
            <div class="scene title-scene active" data-duration="5000">
                <h1>🏠 Real Estate AI Dashboard</h1>
                <p class="subtitle">Automate Your Marketing in Minutes, Not Hours</p>
                <div class="features-showcase">
                    <div class="feature-item">✓ AI Content Generation</div>
                    <div class="feature-item">✓ Multi-Platform Posting</div>
                    <div class="feature-item">✓ SEO Optimization</div>
                    <div class="feature-item">✓ YouTube Integration</div>
                </div>
            </div>
            
            <!-- Scene 2: AI Content Demo -->
            <div class="scene app-scene" data-duration="8000">
                <div class="app-header">
                    <div class="app-title">AI Content Generator</div>
                </div>
                <div class="app-content">
                    <div class="sidebar-demo">
                        <div style="padding: 10px; background: #667eea; color: white; border-radius: 8px; margin-bottom: 10px;">
                            🤖 AI Content
                        </div>
                        <div style="padding: 10px; margin-bottom: 10px;">Social Media</div>
                        <div style="padding: 10px; margin-bottom: 10px;">SEO Tools</div>
                        <div style="padding: 10px; margin-bottom: 10px;">Analytics</div>
                    </div>
                    <div class="main-demo">
                        <h3>Generate Real Estate Content</h3>
                        <div style="margin: 20px 0;">
                            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                <div class="typing-animation" style="overflow: hidden; white-space: nowrap;">
                                    New listing in Benson neighborhood - 3BR ranch home with updated kitchen
                                </div>
                            </div>
                        </div>
                        <div class="demo-action">🎯 Generate AI Content</div>
                        <div style="margin-top: 20px; padding: 20px; background: #e6fffa; border-radius: 8px; border-left: 4px solid #38b2ac;">
                            <strong>AI Generated:</strong><br>
                            🏠 NEW LISTING ALERT! Beautiful 3-bedroom ranch in desirable Benson neighborhood...
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Scene 3: Social Media Demo -->
            <div class="scene app-scene" data-duration="8000">
                <div class="app-header">
                    <div class="app-title">Social Media Manager</div>
                </div>
                <div class="app-content">
                    <div class="sidebar-demo">
                        <div style="padding: 10px; margin-bottom: 10px;">AI Content</div>
                        <div style="padding: 10px; background: #667eea; color: white; border-radius: 8px; margin-bottom: 10px;">
                            📱 Social Media
                        </div>
                        <div style="padding: 10px; margin-bottom: 10px;">SEO Tools</div>
                        <div style="padding: 10px; margin-bottom: 10px;">Analytics</div>
                    </div>
                    <div class="main-demo">
                        <h3>Multi-Platform Posting</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
                            <div style="padding: 15px; background: #3b82f6; color: white; border-radius: 8px; text-align: center;">
                                ✓ Facebook
                            </div>
                            <div style="padding: 15px; background: #e1306c; color: white; border-radius: 8px; text-align: center;">
                                ✓ Instagram
                            </div>
                            <div style="padding: 15px; background: #1da1f2; color: white; border-radius: 8px; text-align: center;">
                                ✓ Twitter
                            </div>
                            <div style="padding: 15px; background: #ff0000; color: white; border-radius: 8px; text-align: center;">
                                ✓ YouTube
                            </div>
                        </div>
                        <div style="background: #fef2f2; border: 2px dashed #f56565; padding: 20px; border-radius: 8px; margin: 15px 0;">
                            🎥 <strong>Video Upload:</strong> demo-property-tour.mp4
                        </div>
                        <div class="demo-action">🚀 Post to All Platforms</div>
                    </div>
                </div>
            </div>
            
            <!-- Scene 4: SEO Demo -->
            <div class="scene app-scene" data-duration="6000">
                <div class="app-header">
                    <div class="app-title">SEO Optimizer</div>
                </div>
                <div class="app-content">
                    <div class="sidebar-demo">
                        <div style="padding: 10px; margin-bottom: 10px;">AI Content</div>
                        <div style="padding: 10px; margin-bottom: 10px;">Social Media</div>
                        <div style="padding: 10px; background: #667eea; color: white; border-radius: 8px; margin-bottom: 10px;">
                            📊 SEO Tools
                        </div>
                        <div style="padding: 10px; margin-bottom: 10px;">Analytics</div>
                    </div>
                    <div class="main-demo">
                        <h3>Local SEO Optimization</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0;">
                            <div style="text-align: center; padding: 15px; background: #f0fff4; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #38a169;">85</div>
                                <div style="color: #4a5568;">Mobile Score</div>
                            </div>
                            <div style="text-align: center; padding: 15px; background: #f0fff4; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #38a169;">92</div>
                                <div style="color: #4a5568;">Desktop Score</div>
                            </div>
                            <div style="text-align: center; padding: 15px; background: #f0fff4; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #38a169;">2.3s</div>
                                <div style="color: #4a5568;">Load Time</div>
                            </div>
                        </div>
                        <div style="background: #edf2f7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <strong>Keywords:</strong> Omaha real estate (#12), Benson homes (#8), Ranch style (#6)
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Scene 5: CTA -->
            <div class="scene cta-scene" data-duration="6000">
                <h1>Ready to Transform Your Marketing?</h1>
                <ul class="benefits-list">
                    <li>✓ Save 10+ hours per week on content creation</li>
                    <li>✓ Increase social media engagement by 300%</li>
                    <li>✓ Boost local SEO rankings</li>
                    <li>✓ Streamline your entire marketing workflow</li>
                </ul>
                <div class="contact-box">
                    <h3>Contact Mike Bjork</h3>
                    <p><strong>Berkshire Hathaway HomeServices</strong></p>
                    <p>📧 mike.bjork@bhhsambassador.com</p>
                    <p>📱 (402) 555-0123</p>
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3);">
                        <strong>Powered by My Golden Brick LLC</strong>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="progress-bar" id="progress"></div>
    </div>

    <script>
        const scenes = document.querySelectorAll('.scene');
        const progressBar = document.getElementById('progress');
        let currentScene = 0;
        let totalDuration = 0;
        let currentTime = 0;
        
        // Calculate total duration
        scenes.forEach(scene => {
            totalDuration += parseInt(scene.dataset.duration);
        });
        
        function showNextScene() {
            if (currentScene < scenes.length - 1) {
                scenes[currentScene].classList.remove('active');
                scenes[currentScene].classList.add('exiting');
                
                currentScene++;
                setTimeout(() => {
                    scenes[currentScene].classList.add('active');
                    scenes[currentScene - 1].classList.remove('exiting');
                }, 500);
            } else {
                // Loop back to start
                scenes[currentScene].classList.remove('active');
                currentScene = 0;
                currentTime = 0;
                setTimeout(() => {
                    scenes[currentScene].classList.add('active');
                }, 500);
            }
        }
        
        function updateProgress() {
            currentTime += 100;
            const progress = (currentTime / totalDuration) * 100;
            progressBar.style.width = progress + '%';
            
            if (currentTime >= totalDuration) {
                currentTime = 0;
            }
        }
        
        // Auto-advance scenes
        let sceneTimer;
        function startDemo() {
            let sceneIndex = 0;
            const sceneDurations = Array.from(scenes).map(s => parseInt(s.dataset.duration));
            
            function nextScene() {
                if (sceneIndex < scenes.length - 1) {
                    sceneIndex++;
                    showNextScene();
                    sceneTimer = setTimeout(nextScene, sceneDurations[sceneIndex]);
                } else {
                    // Restart demo
                    setTimeout(() => {
                        sceneIndex = 0;
                        currentScene = 0;
                        currentTime = 0;
                        scenes.forEach(s => s.classList.remove('active', 'exiting'));
                        scenes[0].classList.add('active');
                        sceneTimer = setTimeout(nextScene, sceneDurations[0]);
                    }, 2000);
                }
            }
            
            sceneTimer = setTimeout(nextScene, sceneDurations[0]);
        }
        
        // Start the demo
        startDemo();
        
        // Update progress bar
        setInterval(updateProgress, 100);
        
        // Allow manual navigation with arrow keys
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                clearTimeout(sceneTimer);
                showNextScene();
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(path.join(config.outputDir, 'animated-demo.html'), animatedDemoHtml);
  console.log('✅ Created animated demo: animated-demo.html');
}

// Create demo script instructions
function createDemoInstructions() {
  const instructions = `
# 🎬 Demo Video Created Successfully!

## 📁 Generated Files:

1. **demo-player.html** - Professional video player interface
2. **animated-demo.html** - Automated animated demo (ready to record)

## 🚀 How to Create Your Final Video:

### Option 1: Record Animated Demo (Easiest)
1. Open: \`http://localhost:5000/demo-video-output/animated-demo.html\`
2. Use screen recording software (OBS, QuickTime, etc.)
3. Record for 2-3 minutes as it auto-plays through all scenes
4. Export as MP4 - you're done!

### Option 2: Manual Recording with Your App
1. Follow the detailed guide in \`complete-demo-creation-guide.md\`
2. Record PowerPoint slides + app interactions
3. Edit together in video software

## ✨ Features of Your Animated Demo:

- ✅ **Auto-playing scenes** - no manual clicking needed
- ✅ **Professional animations** - smooth transitions and effects  
- ✅ **Complete workflow** - shows entire AI to social media process
- ✅ **Perfect timing** - 2-3 minutes total duration
- ✅ **Ready to record** - just start screen capture and let it run

## 🎯 What the Demo Shows:

1. **Title & Branding** (5s) - Your value proposition
2. **AI Content Generation** (8s) - Live typing animation showing property input
3. **Social Media Posting** (8s) - Multi-platform selection with YouTube upload
4. **SEO Optimization** (6s) - Performance metrics and keyword tracking
5. **Call to Action** (6s) - Contact info and benefits

## 🎥 Recording Tips:

- Use 1920x1080 resolution
- Record at 30fps or higher
- Keep audio on for any background music
- Let it loop 1-2 times for options

**Your animated demo is ready to record right now!** 
Open \`http://localhost:5000/demo-video-output/animated-demo.html\` and start recording.
`;

  fs.writeFileSync(path.join(config.outputDir, 'README.md'), instructions);
  console.log('✅ Created instructions: README.md');
}

// Main execution
function main() {
  console.log('🎬 Creating Real Estate AI Dashboard Demo Video...\n');
  
  createOutputDir();
  createVideoPlayer();
  createAnimatedDemo();
  createDemoInstructions();
  
  console.log('\n🎉 Demo video creation complete!');
  console.log(`📁 Files created in: ${config.outputDir}`);
  console.log('🚀 Ready to record your demo video!');
  console.log('\n📖 Next steps:');
  console.log('1. Open: http://localhost:5000/demo-video-output/animated-demo.html');
  console.log('2. Start screen recording software');
  console.log('3. Record for 2-3 minutes as it auto-plays');
  console.log('4. Export as MP4 - your demo video is ready!');
}

// Run the script
main();