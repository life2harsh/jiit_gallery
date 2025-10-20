const IMAGEKIT_CONFIG = {
    urlEndpoint: 'https://ik.imagekit.io/qijr3yqwa',
    photosPath: 'photos',
    useManifest: true
};

let images = [];
let availableTags = new Set();
let currentFilter = 'all';

function getImageKitUrl(path) {
    return `${IMAGEKIT_CONFIG.urlEndpoint}/${encodeURI(path)}`;
}

async function loadImagesFromImageKit() {
    showLoadingMessage();
    
    try {
        if (IMAGEKIT_CONFIG.useManifest) {
            await loadImagesFromManifest();
        } else {
            await loadImagesByDiscovery();
        }
        
        console.log(`Loaded ${images.length} images from ImageKit`);
        console.log('Available tags:', Array.from(availableTags));
        
        generateFilterButtons();
        renderGallery();
        
    } catch (error) {
        console.error('Error loading images from ImageKit:', error);
        showErrorMessage();
    }
}

async function loadImagesFromManifest() {
    try {
        const response = await fetch('images-manifest.json');
        const manifest = await response.json();
        
        let imageId = 1;
        
        for (const [categoryName, resolutions] of Object.entries(manifest.categories)) {
            availableTags.add(categoryName);
            
            for (const [resolution, filenames] of Object.entries(resolutions)) {
                for (const filename of filenames) {
                    const folderMap = {
                        'Cafeteria': 'cafeteria',
                        'Campus': 'campus',
                        'Classrooms': 'classrooms',
                        'Counselling': 'counselling',
                        'Library(LRC)': 'library',
                        'Mess': 'mess'
                    };
                    
                    const folderName = folderMap[categoryName] || categoryName.toLowerCase();
                    const imagePath = `${IMAGEKIT_CONFIG.photosPath}/${resolution}/${folderName}/${filename}`;
                    const imageUrl = getImageKitUrl(imagePath);
                    
                    images.push({
                        id: imageId++,
                        url: imageUrl,
                        tag: categoryName,
                        batch: resolution,
                        description: '',
                        name: filename,
                        path: imagePath
                    });
                }
            }
        }
        
        availableTags.add('128');
        
    } catch (error) {
        console.error('Error loading manifest:', error);
        console.log('Falling back to discovery mode...');
        await loadImagesByDiscovery();
    }
}

async function loadImagesByDiscovery() {
    const categories = {
        'cafeteria': { name: 'Cafeteria', images: [] },
        'campus': { name: 'Campus', images: [] },
        'classrooms': { name: 'Classrooms', images: [] },
        'counselling': { name: 'Counselling', images: [] },
        'library': { name: 'Library(LRC)', images: [] },
        'mess': { name: 'Mess', images: [] }
    };
    
    const resolutionFolders = ['62', '128'];
    let imageId = 1;
    
    for (const resFolder of resolutionFolders) {
        for (const [folderKey, categoryData] of Object.entries(categories)) {
            const folderPath = `${IMAGEKIT_CONFIG.photosPath}/${resFolder}/${folderKey}`;
            availableTags.add(categoryData.name);
            
            const imageUrls = await fetchAllImagesInFolder(folderPath, categoryData.name);
            imageUrls.forEach(url => {
                images.push({
                    id: imageId++,
                    url: url,
                    tag: categoryData.name,
                    batch: resFolder,
                    description: '',
                    path: url.replace(IMAGEKIT_CONFIG.urlEndpoint + '/', '')
                });
            });
        }
    }
    
    availableTags.add('128');
}

async function fetchAllImagesInFolder(folderPath, tag) {
    const imageUrls = [];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const maxImages = 200;
    const batchSize = 10;
    
    for (let i = 1; i <= maxImages; i += batchSize) {
        const batch = [];
        
        for (let j = i; j < i + batchSize && j <= maxImages; j++) {
            for (const ext of imageExtensions) {
                const testUrl = getImageKitUrl(`${folderPath}/${j}.${ext}`);
                batch.push(
                    checkImageExists(testUrl)
                        .then(exists => exists ? testUrl : null)
                        .catch(() => null)
                );
            }
        }
        
        const results = await Promise.all(batch);
        const validUrls = results.filter(url => url !== null);
        imageUrls.push(...validUrls);
        
        if (validUrls.length === 0 && i > 20) {
            break;
        }
    }
    
    return imageUrls;
}

async function checkImageExists(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(url, { 
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        return false;
    }
}

function formatTagName(folderName) {
    const tagMap = {
        'cafeteria': 'Cafeteria',
        'campus': 'Campus',
        'classrooms': 'Classrooms',
        'counselling': 'Counselling',
        'library': 'Library(LRC)',
        'mess': 'Mess'
    };
    
    return tagMap[folderName.toLowerCase()] || folderName.charAt(0).toUpperCase() + folderName.slice(1);
}

function generateFilterButtons() {
    const sortButtons = document.querySelector('.sort-buttons');
    if (!sortButtons) return;
    
    sortButtons.innerHTML = '<button class="sort-button active" onclick="sortByTag(\'all\', this)">All</button>';
    
    const batchButton = document.createElement('button');
    batchButton.className = 'sort-button batch-button';
    batchButton.textContent = '128';
    batchButton.onclick = function() { sortByTag('128', this); };
    sortButtons.appendChild(batchButton);
    
    const separator = document.createElement('span');
    separator.className = 'button-separator';
    separator.textContent = '|';
    sortButtons.appendChild(separator);
    
    const categoryTags = Array.from(availableTags).filter(tag => tag !== '128').sort();
    categoryTags.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'sort-button';
        button.textContent = tag;
        button.onclick = function() { sortByTag(tag, this); };
        sortButtons.appendChild(button);
    });
}

function showLoadingMessage() {
    const gallery = document.getElementById('gallery');
    if (gallery) {
        gallery.innerHTML = `
            <div class="no-images">
                <div class="loading-spinner" style="display: block; margin: 20px auto;"></div>
                <p>Loading images from ImageKit...</p>
            </div>
        `;
    }
}

function showErrorMessage() {
    const gallery = document.getElementById('gallery');
    if (gallery) {
        gallery.innerHTML = `
            <div class="no-images">
                <p>Error loading images. Please check the console for details.</p>
            </div>
        `;
    }
}

function sortByTag(tag, clickedButton) {
    currentFilter = tag;
    document.querySelectorAll('.sort-button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    renderGallery();
}

function renderGallery() {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;
    
    let filteredImages = images;
    
    if (currentFilter !== 'all') {
        if (currentFilter === '128') {
            filteredImages = images.filter(image => image.batch === '128');
        } else {
            filteredImages = images.filter(image => {
                const tagLower = (image.tag || '').toLowerCase();
                const filterLower = currentFilter.toLowerCase();
                return tagLower === filterLower;
            });
        }
    }

    if (filteredImages.length === 0) {
        gallery.innerHTML = `
            <div class="no-images">
                <p>No images found for "${currentFilter}".</p>
            </div>
        `;
        return;
    }

    gallery.innerHTML = filteredImages.map((image, index) => {
        const originalIndex = images.findIndex(img => img.id === image.id);
        return `
            <div class="image-card" style="--card-index: ${index}">
                <div class="image-container" onclick="openModal(${originalIndex})">
                    <img src="${image.url}" alt="${image.tag || 'Image'}" loading="lazy">
                    ${image.tag ? `<div class="image-tag">${image.tag}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

let currentImageIndex = 0;

function openModal(index) {
    currentImageIndex = index;
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    const modalTag = document.getElementById('modalTag');
    const modalInfo = document.getElementById('modalInfo');
    const modalCounter = document.getElementById('modalCounter');
    const loadingSpinner = document.getElementById('loadingSpinner');

    if (!modal || !modalImg) return;

    modal.classList.add('show');
    loadingSpinner.style.display = 'block';
    modalImg.style.display = 'none';

    const image = images[index];
    modalImg.src = image.url;
    modalImg.alt = image.tag || 'Image';
    
    if (image.tag && image.batch) {
        modalTag.textContent = `${image.batch} - ${image.tag}`;
        modalInfo.style.display = 'block';
    } else if (image.tag) {
        modalTag.textContent = image.tag;
        modalInfo.style.display = 'block';
    } else {
        modalInfo.style.display = 'none';
    }
    
    modalCounter.textContent = `${index + 1} / ${images.length}`;

    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

function nextImage() {
    currentImageIndex = (currentImageIndex + 1) % images.length;
    updateModalImage();
}

function prevImage() {
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    updateModalImage();
}

function updateModalImage() {
    const modalImg = document.getElementById('modalImg');
    const modalTag = document.getElementById('modalTag');
    const modalInfo = document.getElementById('modalInfo');
    const modalCounter = document.getElementById('modalCounter');
    const loadingSpinner = document.getElementById('loadingSpinner');

    if (!modalImg) return;

    loadingSpinner.style.display = 'block';
    modalImg.style.display = 'none';

    const image = images[currentImageIndex];
    modalImg.src = image.url;
    modalImg.alt = image.tag || 'Image';
    
    if (image.tag && image.batch) {
        modalTag.textContent = `${image.batch} - ${image.tag}`;
        modalInfo.style.display = 'block';
    } else if (image.tag) {
        modalTag.textContent = image.tag;
        modalInfo.style.display = 'block';
    } else {
        modalInfo.style.display = 'none';
    }
    
    modalCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
}

function hideSpinner() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const modalImg = document.getElementById('modalImg');
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (modalImg) modalImg.style.display = 'block';
}

function showError() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const modalImg = document.getElementById('modalImg');
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (modalImg) {
        modalImg.style.display = 'block';
        modalImg.alt = 'Failed to load image';
    }
}

document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('imageModal');
    if (modal && modal.classList.contains('show')) {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'ArrowRight') nextImage();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    }

    let touchStartX = 0, touchEndX = 0;
    if (modal) {
        modal.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        modal.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) nextImage();
                else prevImage();
            }
        }, false);
    }

    loadImagesFromImageKit();
});
