document.addEventListener('DOMContentLoaded', () => {
    const mainCarousel = $('#product-carousel');
    const subImages = document.querySelectorAll('.sub-image');
    const modalImage = document.getElementById('modalImage');
    const sizeOptions = document.getElementById('sizeOptions');

    // Sub-image click event
    subImages.forEach(subImage => {
        subImage.addEventListener('click', function () {
            const index = this.getAttribute('data-index');
            mainCarousel.carousel(parseInt(index));
            updateActiveSubImage(index);
        });
    });

    // Update sub-image active border
    function updateActiveSubImage(activeIndex) {
        subImages.forEach((img, index) => {
            img.parentElement.classList.toggle('active', index == activeIndex);
        });
    }

    // Main image carousel slide event
    mainCarousel.on('slide.bs.carousel', function (e) {
        updateActiveSubImage(e.to);
        initZoom();
    });

    // Main image click event to show modal
    document.querySelectorAll('.main-image').forEach(image => {
        image.addEventListener('click', function () {
            modalImage.src = this.src;
        });
    });

    // Initialize first sub-image as active
    updateActiveSubImage(0);

    // Color option change event
    const colorOptions = document.querySelectorAll('input[name="color"]');
    const carouselInner = document.getElementById('carousel-inner');
    const productImgs = document.getElementById('product-imgs');

    const zoomResult = document.getElementById('zoom-result');
    const zoomLens = document.createElement('div');
    zoomLens.setAttribute('class', 'zoom-lens');
    document.body.appendChild(zoomLens);

    function initZoom() {
        const activeImage = document.querySelector('.carousel-item.active .main-image');
        if (activeImage) {
            activeImage.addEventListener('mouseover', showZoom);
            activeImage.addEventListener('mousemove', moveLens);
            activeImage.addEventListener('mouseout', hideZoom);
        }
    }

    function showZoom(e) {
        const image = e.target;
        zoomLens.style.display = 'block';
        zoomResult.style.display = 'block';
        zoomResult.style.backgroundImage = `url(${image.src})`;
    }

    function moveLens(e) {
        const image = e.target;
        const pos = getCursorPos(e, image);
        const lensWidth = zoomLens.offsetWidth / 2;
        const lensHeight = zoomLens.offsetHeight / 2;
        let x = pos.x - lensWidth;
        let y = pos.y - lensHeight;

        if (x > image.width - lensWidth) x = image.width - lensWidth;
        if (x < 0) x = 0;
        if (y > image.height - lensHeight) y = image.height - lensHeight;
        if (y < 0) y = 0;

        zoomLens.style.left = x + 'px';
        zoomLens.style.top = y + 'px';

        const cx = zoomResult.offsetWidth / zoomLens.offsetWidth;
        const cy = zoomResult.offsetHeight / zoomLens.offsetHeight;

        zoomResult.style.backgroundSize = `${image.width * cx}px ${image.height * cy}px`;
        zoomResult.style.backgroundPosition = `-${x * cx}px -${y * cy}px`;
    }

    function hideZoom() {
        zoomLens.style.display = 'none';
        zoomResult.style.display = 'none';
    }

    function getCursorPos(e, image) {
        const rect = image.getBoundingClientRect();
        const x = e.pageX - rect.left - window.pageXOffset;
        const y = e.pageY - rect.top - window.pageYOffset;
        return { x: x, y: y };
    }
    // // Update size options based on selected color variant
    function updateSizeOptions(subVariants) {
        sizeOptions.innerHTML = '';
        subVariants.forEach((subVariant, index) => {
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'size';
            input.id = `size${index}`;
            input.value = subVariant.size;
            input.setAttribute('data-subvariant', JSON.stringify(subVariant));
            input.checked = index === 0;
            const label = document.createElement('label');
            label.htmlFor = `size${index}`;
            label.className = 'size-label';
            label.textContent = subVariant.size;
            input.addEventListener('change', function () {
                updateQuantity();
            });
            sizeOptions.appendChild(input);
            sizeOptions.appendChild(label);
        });

        const firstSizeOption = sizeOptions.querySelector('input[name="size"]:checked');
        if (firstSizeOption) {
            updateQuantity();
        }
    }

    function updatePrices(price) {
        const selectedColorRadio = document.querySelector('input[name="color"]:checked');
        if (selectedColorRadio) {
            const selectedVariantData = selectedColorRadio.getAttribute('data-variant');
            const selectedVariant = JSON.parse(selectedVariantData);
            if (selectedVariant) {
                document.getElementById('discounted-price').textContent = selectedVariant.discountPrice ?? selectedVariant.price;
                document.getElementById('original-price').textContent = selectedVariant.price;
            }
        }
    }

    colorOptions.forEach(option => {
        option.addEventListener('change', function () {
            const images = JSON.parse(this.getAttribute('data-images'));
            const prices = JSON.parse(this.getAttribute('data-prices'));
            const subVariants = JSON.parse(this.getAttribute('data-subvariants'));
            updateCarousel(images);
            updateSubImages(images);
            updateSizeOptions(subVariants);
            updatePrices(prices);
            initZoom();
            const firstSizeOption = document.querySelector('input[name="size"]:checked');
            if (firstSizeOption) {
                updateQuantity();
            }
        });
    });

    //update quantity function
    function updateQuantity() {
        const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
        if (selectedSizeRadio) {
            const selectedSubVariantData = selectedSizeRadio.getAttribute('data-subvariant');
            const selectedSubVariant = JSON.parse(selectedSubVariantData);
            console.log(selectedSubVariant);
            if (selectedSubVariant) {
                const sizeAvailabilityDiv = document.querySelector('.product-available');
                if (selectedSubVariant.quantity === 0) {
                    sizeAvailabilityDiv.innerHTML = '<span class="text-secondary">Out of Stock</span>';
                } else if (selectedSubVariant.quantity < 10) {
                    sizeAvailabilityDiv.innerHTML = `<span>Only ${selectedSubVariant.quantity} Items remaining!</span>`;
                } else {
                    sizeAvailabilityDiv.innerHTML = '<span class="text-success">In stock</span>';
                }
            }
        }
    }

    function updatePrice(productId) {
        const selectedVariant = document.querySelector(`input[name="color-${productId}"]:checked`);
        if (selectedVariant) {
            const newPrice = selectedVariant.dataset.price;
            const newDiscPrice = selectedVariant.dataset.discPrice;

            console.log(`Updating price for product ${productId} to ${newDiscPrice} and ${newPrice}`);

            const priceElement = document.querySelector(`#product-price-${productId}`);
            const discPriceElement = document.querySelector(`#product-disc-price-${productId}`);

            if (priceElement && discPriceElement) {
                discPriceElement.textContent = `₹${newDiscPrice}`;
                priceElement.textContent = `₹${newPrice}`;
            } else {
                console.error(`Price elements not found for product ${productId}`);
            }
        } else {
            console.error(`Selected variant not found for product ${productId}`);
        }
    }

    document.querySelectorAll('input[type="radio"][name^="color-"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const productId = e.target.name.split('-')[1];
            updatePrice(productId);
        });
    });

    document.querySelectorAll('input[type="radio"][name^="color-"]:checked').forEach(radio => {
        const productId = radio.name.split('-')[1];
        updatePrice(productId);
    });

    // Initialize the first variant and size on page load
    const firstColorOption = document.querySelector('input[name="color"]:checked');
    if (firstColorOption) {
        firstColorOption.dispatchEvent(new Event('change'));
    }


    function updateCarousel(images) {
        carouselInner.innerHTML = '';
        images.forEach((image, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `carousel-item ${index === 0 ? 'active' : ''}`;
            const img = document.createElement('img');
            img.src = `/static/productImages/${image}`;
            img.className = 'd-block w-100 h-100 main-image';
            img.alt = 'Product Image';
            img.dataset.toggle = 'modal';
            img.dataset.target = '#imageModal';
            img.width = 400;
            img.height = 400;
            itemDiv.appendChild(img);
            carouselInner.appendChild(itemDiv);
        });
        initZoom();
    }

    function updateSubImages(images) {
        productImgs.innerHTML = '';
        images.forEach((image, index) => {
            const div = document.createElement('div');
            div.className = 'product-preview mx-1';
            const img = document.createElement('img');
            img.src = `/static/productImages/${image}`;
            img.alt = 'Product Thumbnail';
            img.className = 'sub-image';
            img.dataset.index = index;
            div.appendChild(img);
            productImgs.appendChild(div);
        });

        // Re-add click event listeners to new sub-images
        document.querySelectorAll('.sub-image').forEach(subImage => {
            subImage.addEventListener('click', function () {
                const index = this.getAttribute('data-index');
                mainCarousel.carousel(parseInt(index));
                updateActiveSubImage(index);
            });
        });
    }
    initZoom();


    //related products color change
    const colorSelectors = document.querySelectorAll('.product__color__select input[type="radio"]');
    colorSelectors.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.checked) {
                const productImageElement = document.getElementById(`product-image-${this.closest('.product__item').querySelector('.add-cart').dataset.productId}`);
                productImageElement.style.backgroundImage = `url('${this.dataset.imageUrl}')`;

                // Remove 'active' class from all labels in the same group
                this.closest('.product__color__select').querySelectorAll('label').forEach(label => label.classList.remove('active'));

                // Add 'active' class to the selected label
                this.closest('label').classList.add('active');
            }
        });
    });
});