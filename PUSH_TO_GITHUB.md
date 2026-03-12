# Push this project to GitHub

1. **Create a new repository on GitHub** (if you haven’t already):
   - Go to https://github.com/new
   - Repository name: `MobileGarage` (or any name you prefer)
   - Leave it empty (no README, .gitignore, or license)
   - Create repository

2. **Add the remote and push** (replace `YOUR_GITHUB_USERNAME` with your GitHub username):

   ```bash
   cd E:\VSCodeProjects\Mobile_Garage
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/MobileGarage.git
   git push -u origin main
   ```

   If you use SSH:

   ```bash
   git remote add origin git@github.com:YOUR_GITHUB_USERNAME/MobileGarage.git
   git push -u origin main
   ```

3. When prompted, sign in with your GitHub account (browser or token).
