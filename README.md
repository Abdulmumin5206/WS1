# Report Builder

A modern React application for creating professional reports with sections and images.

## Features

- Create and edit report sections
- Rich text content
- Upload images with captions
- Drag and drop functionality
- Advanced image handling with auto-alignment and cropping
- Export reports as PDF with automatic pagination

## Image Handling Features

- Automatic image alignment for consistent presentation
- Manual image cropping with interactive editor
- Auto-fit option to standardize aspect ratios
- Support for different layout options (1, 2, or 3 images per row)
- Intelligent processing of images with unusual dimensions
- Visual indicators for images that need adjustment
- Maintains image quality during processing

## PDF Export Features

- Title page with report name and date
- Content pages with all report sections and images
- Automatic pagination for long reports
- Page numbers
- Clean layout hiding UI elements
- High-quality image rendering

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `src/app/`: Next.js app directory
- `src/components/`: React components
- `src/styles/`: Global styles

## Technologies Used

- React.js
- Next.js
- TypeScript
- Tailwind CSS
- Lucide React (icons)
- jsPDF (PDF generation)
- html2canvas (HTML to canvas conversion)
- Canvas API for image processing

## Future Enhancements

- Rich text editor integration
- Templates support
- Cloud storage integration
- Collaborative editing 
- Advanced image filters and effects 