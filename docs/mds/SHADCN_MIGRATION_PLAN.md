# shadcn/ui + TailwindCSS Migration Plan

## Overview
Migrate from Chakra UI to shadcn/ui + TailwindCSS for a more modern, flexible, and industry-standard UI.

## Steps

### 1. Install Dependencies
```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install lucide-react class-variance-authority clsx tailwind-merge
```

### 2. Setup TailwindCSS
- Configure `tailwind.config.js`
- Add Tailwind directives to CSS
- Update `package.json` scripts

### 3. Install shadcn/ui
```bash
npx shadcn-ui@latest init
```

### 4. Install Required Components
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add select
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
```

### 5. Migration Strategy
- Create new components using shadcn/ui
- Gradually replace Chakra UI components
- Update GlobalFilterPanel with cascading filters
- Add advanced icons from lucide-react
- Maintain existing functionality

### 6. Advanced UI Features
- Add loading states with skeletons
- Implement advanced animations
- Add tooltips and popovers
- Enhanced data tables
- Better responsive design

## Timeline
- Phase 1: Setup and core components (2-3 hours)
- Phase 2: Filter panel migration (1-2 hours)
- Phase 3: Dashboard components (2-3 hours)
- Phase 4: Polish and testing (1-2 hours)

