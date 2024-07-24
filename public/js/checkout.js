document.addEventListener('DOMContentLoaded', (event) => {
    var firstAddressRadio = document.querySelector('input[name="address"]');
    if (firstAddressRadio) {
        firstAddressRadio.checked = true;
        var selectedAddressIndex = firstAddressRadio.value;
        var selectedAddress = document.querySelector('label[for="address-' + selectedAddressIndex + '"]').innerText;
        document.getElementById("addressDetails").value = selectedAddressIndex;
        document.getElementById("current-address").innerText = "Current Address: " + selectedAddress;
    }
});

const modalc = document.getElementById("myModalc");
const addAddressModal = document.getElementById("addAddressModal");
const couponModal = document.getElementById("couponModal");
const btn = document.getElementById("change-address-btn");
const spanCloseModalc = document.querySelector("#myModalc .close");
const spanCloseAddAddressModal = document.querySelector("#addAddressModal .close");
const selectBtn = document.getElementById("select-address-btn");
const addAddressLink = document.getElementById('add-address-link');
const currentAddress = document.getElementById("current-address");
const btnOpenModal = document.getElementById('openCouponModal');
const spanCloseModal = document.querySelector("#couponModal .close");

if (btn) {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        modalc.style.display = "block";
    });
}

if (addAddressLink) {
    addAddressLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (modalc.style.display = "none") {
            modalc.style.display = 'block';
        }
        addAddressModal.style.display = "block";
    });
}

btnOpenModal.onclick = function () {
    couponModal.style.display = 'block';
};

spanCloseModalc.onclick = function () {
    modalc.style.display = "none";
};

spanCloseModal.onclick = function () {
    couponModal.style.display = "none";
};

spanCloseAddAddressModal.onclick = function () {
    addAddressModal.style.display = "none";
};

window.onclick = function (event) {
    if (event.target == modalc) {
        modalc.style.display = "none";
    } else if (event.target == addAddressModal) {
        addAddressModal.style.display = "none";
    } else if (event.target == couponModal) {
        couponModal.style.display = "none";
    }
};

var addAddressForm = document.getElementById("add-address-form");
addAddressForm.onsubmit = async function (event) {
    event.preventDefault();

    var errorMessagesDiv = document.getElementById("error-messages");
    errorMessagesDiv.innerHTML = ''; // Clear previous error messages

    const addressName = document.getElementById("addressName").value.trim();
    const addressEmail = document.getElementById("addressEmail").value.trim();
    const addressMobile = document.getElementById("addressMobile").value.trim();
    const addressHouse = document.getElementById("addressHouse").value.trim();
    const addressStreet = document.getElementById("addressStreet").value.trim();
    const addressPost = document.getElementById("addressPost").value.trim();
    const addressCity = document.getElementById("addressCity").value.trim();
    const addressDistrict = document.getElementById("addressDistrict").value.trim();
    const addressState = document.getElementById("addressState").value.trim();
    const addressPin = document.getElementById("addressPin").value.trim();

    let errors = [];

    if (!addressName) {
        errors.push('Name is required.');
    }

    if (!addressEmail) {
        errors.push('Email is required.');
    } else if (!/^\S+@\S+\.\S+$/.test(addressEmail)) {
        errors.push('Please enter a valid email address.');
    }

    if (!addressMobile) {
        errors.push('Mobile number is required.');
    } else if (!/^[1-9][0-9]{9}$/.test(addressMobile)) {
        errors.push('Please enter a valid 10-digit mobile number.');
    }

    if (!addressHouse) {
        errors.push('House name is required.');
    }

    if (!addressStreet) {
        errors.push('Street name is required.');
    }

    if (!addressPost) {
        errors.push('Post office name is required.');
    }

    if (!addressCity) {
        errors.push('City name is required.');
    }

    if (!addressDistrict) {
        errors.push('District name is required.');
    }

    if (!addressState) {
        errors.push('State name is required.');
    }

    if (!addressPin) {
        errors.push('PIN code is required.');
    } else if (!/^[0-9]{6}$/.test(addressPin)) {
        errors.push('Please enter a valid 6-digit PIN code.');
    }

    if (errors.length > 0) {
        errorMessagesDiv.innerHTML = errors.join('<br>');
        return;
    }

    var newAddress = {
        addressName: addressName,
        addressEmail: addressEmail,
        addressMobile: addressMobile,
        addressHouse: addressHouse,
        addressStreet: addressStreet,
        addressPost: addressPost,
        addressMark: document.getElementById("addressMark").value,
        addressCity: addressCity,
        addressDistrict: addressDistrict,
        addressState: addressState,
        addressPin: addressPin
    };

    try {
        const response = await fetch('/checkout/add_address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newAddress)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Address Added',
                text: data.message,
            });
            addAddressToList(newAddress);
        addAddressModal.style.display = "none";
        modalc.style.display = 'none'; 
        addAddressForm.reset();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.message,
            });
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Unexpected Error',
            text: 'An unexpected error occurred. Please try again later.',
        });
    }
};

selectBtn.onclick = function () {
    var selectedAddressRadio = document.querySelector('input[name="address"]:checked');
    if (selectedAddressRadio) {
        var selectedAddressIndex = selectedAddressRadio.value;
        var selectedAddress = document.querySelector('label[for="address-' + selectedAddressIndex + '"]').innerText;
        document.getElementById("addressDetails").value = selectedAddressIndex;
        currentAddress.innerText = "Current Address: " + selectedAddress;
        modalc.style.display = "none";
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'No Address Selected',
            text: 'Please select an address.',
        });
    }
};

function addAddressToList(address) {
    var addressList = document.getElementById("address-list");
    var index = addressList.children.length;

    var listItem = document.createElement("li");
    listItem.innerHTML = `
        <div class="row mb-2">
            <div class="col-1 mt-2">
                <input type="radio" name="address" id="address-${index}" value="${index}">
            </div>
            <div class="col-11">
                <label for="address-${index}">
                    ${address.addressName}, ${address.addressEmail}, ${address.addressMobile},
                    ${address.addressHouse}, ${address.addressStreet}, ${address.addressPost},
                    ${address.addressCity}, ${address.addressDistrict}, ${address.addressState},
                    ${address.addressPin}
                </label>
            </div>
        </div>`;

    addressList.appendChild(listItem);

    // Automatically select the newly added address
    var newAddressRadio = document.getElementById(`address-${index}`);
    if (newAddressRadio) {
        newAddressRadio.checked = true;
        var selectedAddress = document.querySelector('label[for="address-' + index + '"]').innerText;
        var addressDetails = document.getElementById("addressDetails");
        var currentAddress = document.getElementById("current-address");

        if (addressDetails) {
            addressDetails.value = index;
        } else {
            console.warn('Element with ID "addressDetails" not found.');
        }

        if (currentAddress) {
            currentAddress.innerText = "Current Address: " + selectedAddress;
        } else {
            console.warn('Element with ID "current-address" not found. Creating it dynamically.');

            // Create currentAddress element if it doesn't exist
            var newCurrentAddress = document.createElement('div');
            newCurrentAddress.id = 'current-address';
            newCurrentAddress.innerText = "Current Address: " + selectedAddress;
            document.querySelector('.address-container').appendChild(newCurrentAddress);
        }

        newAddressRadio.onclick = function () {
            if (addressDetails) {
                addressDetails.value = index;
            }
            if (currentAddress) {
                currentAddress.innerText = "Current Address: " + selectedAddress;
            }
        };
    } else {
        console.error('Radio button with ID "address-' + index + '" not found.');
    }
}

function formatPrice(price) {
    return `₹${price.toFixed(2)}`;
}

function calculatePrices(items, couponDiscount = 0) {
    let subtotal = 0;
    let discount = 0;
    let total = 0;
    items.forEach(item => {
        subtotal += item.productPrice * item.productQuantity;
        discount += (item.productPrice - item.productDiscPrice) * item.productQuantity;
        total += item.productDiscPrice * item.productQuantity;
    });
    total -= couponDiscount;
    return { subtotal, total, discount };
}

// Retrieve and parse cart data
const cartData = document.getElementById('cartData').value;
const cart = JSON.parse(cartData);

// Initial calculation without coupon
const prices = calculatePrices(cart);
let subtotal = prices.subtotal;
let discount = prices.discount;
let total = prices.total;

document.getElementById('subtotal').innerHTML = formatPrice(prices.subtotal);
document.getElementById('discount').innerHTML = `-${formatPrice(prices.discount)}`;
document.getElementById('coupon-discount').innerHTML = formatPrice(0);
document.getElementById('total').innerHTML = formatPrice(prices.total);

// Show coupon field
document.getElementById('show-coupon').addEventListener('click', function (event) {
    event.preventDefault();
    document.getElementById('coupon-field').style.display = 'block';
});

// Apply coupon
document.getElementById('apply-coupon').addEventListener('click', function () {
    const code = document.getElementById('coupon-code').value;
    fetch('/checkout/apply_coupon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const couponDiscount = data.discount; // Get coupon discount
                const discountPercentage = data.percentage;

                // Update the totals with the coupon discount
                const updatedPrices = calculatePrices(cart, couponDiscount);

                document.getElementById('subtotal').textContent = formatPrice(updatedPrices.subtotal);
                document.getElementById('discount').textContent = `-${formatPrice(updatedPrices.discount)}`;
                document.getElementById('coupon-discount').textContent = `-${formatPrice(couponDiscount)}`;
                document.getElementById('total').textContent = formatPrice(updatedPrices.total);
                document.getElementById('coupon-message').textContent = 'Coupon applied!';
                document.getElementById('apply-coupon').style.display = 'none';
                document.getElementById('remove-coupon').style.display = 'inline-block';
                document.getElementById('discountPercentage').value = discountPercentage;
            } else {
                document.getElementById('coupon-message').textContent = data.message;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('coupon-message').textContent = 'An error occurred while applying the coupon.';
        });
});

document.getElementById('remove-coupon').addEventListener('click', function () {
    fetch('/checkout/remove_coupon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the totals without the coupon discount
                document.getElementById('subtotal').textContent = formatPrice(data.subtotal);
                document.getElementById('discount').textContent = `-${formatPrice(data.offerDiscount)}`;
                document.getElementById('coupon-discount').textContent = formatPrice(0);
                document.getElementById('total').textContent = formatPrice(data.total);
                document.getElementById('coupon-message').textContent = 'Coupon removed!';
                document.getElementById('apply-coupon').style.display = 'inline-block';
                document.getElementById('remove-coupon').style.display = 'none';
                document.getElementById('coupon-code').value = '';
                document.getElementById('discountPercentage').value = 0;
            } else {
                document.getElementById('coupon-message').textContent = data.message;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('coupon-message').textContent = 'An error occurred while removing the coupon.';
        });
});


document.getElementById('checkout-form').onsubmit = async function (event) {
    event.preventDefault();

    const selectedAddressIndex = document.getElementById('addressDetails').value;
    const selectedPaymentMethod = document.querySelector('input[name="payment"]:checked');

    if (selectedAddressIndex === "" || !selectedPaymentMethod) {
        Swal.fire({
            icon: 'warning',
            title: 'Incomplete Selection',
            text: 'Please select an address and a payment method.',
        });
        return;
    }

    document.getElementById('paymentOption').value = selectedPaymentMethod.value;

    // Retrieve and parse cart data
    const cartData = JSON.parse(document.getElementById('cartData').value);

    // Calculate the final price
    const couponDiscount = parseFloat(document.getElementById('coupon-discount').textContent.replace('₹', '').replace('-', '')) || 0;
    const discountPercentage = parseFloat(document.getElementById('discountPercentage').value) || 0;
    const prices = calculatePrices(cartData, couponDiscount);
    const code = document.getElementById('coupon-code').value;
    const finalPrice = prices.total;
    console.log(finalPrice);

    if (selectedPaymentMethod.value === 'RazorPay') {
        try {
            const response = await fetch('/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cartData: document.getElementById('cartData').value,
                    addressDetails: selectedAddressIndex,
                    paymentOption: selectedPaymentMethod.value,
                    discountPercentage,
                    finalPrice: finalPrice,
                    code
                })
            });
            const data = await response.json();

            if (response.ok) {
                const keyResponse = await fetch('/razorpay_key');
                const keyData = await keyResponse.json();
                const options = {
                    key: keyData.key,
                    amount: data.amount,
                    currency: data.currency,
                    order_id: data.razorpayOrderId,
                    handler: async function (response) {
                        const paymentData = {
                            orderCreationId: data.razorpayOrderId,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpayOrderId: response.razorpay_order_id,
                            razorpaySignature: response.razorpay_signature,
                            orderData: data.orderData
                        };
                        try {
                            const verifyResponse = await fetch('/verify_razorpay_payment', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(paymentData)
                            });
                            const verifyData = await verifyResponse.json();
                            if (verifyResponse.ok) {
                                Swal.fire({
                                    icon: 'success',
                                    title: 'Payment Successful',
                                    text: 'Your order has been placed successfully.',
                                }).then(() => {
                                    window.location.href = '/shop';
                                });
                            } else {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Payment Verification Failed',
                                    text: verifyData.error,
                                });
                            }
                        } catch (error) {
                            console.error('Error verifying payment:', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Payment Verification Error',
                                text: 'Failed to verify payment. Please contact support.',
                            });
                        }
                    },
                    prefill: {
                        name: 'Customer Name',
                        email: 'customer@example.com',
                        contact: '9999999999'
                    },
                    theme: {
                        color: '#3399cc'
                    }
                };
                const rzp1 = new Razorpay(options);
                rzp1.on('payment.failed', function (response) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Payment Failed',
                        text: 'Order placed. You can continue pay from orders page',
                    }).then(async () => {
                        await fetch('/handle_failed_payment', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ orderData: data.orderData })
                        });
                        window.location.href = '/account/orders';
                    });
                });
                rzp1.open();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.error,
                    showCancelButton: true,
                    confirmButtonText: 'Go to Cart',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = '/cart';
                    }
                });
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Unexpected Error',
                text: 'An unexpected error occurred. Please try again later.',
            });
        }
    } else if (selectedPaymentMethod.value === 'COD') {
        if (finalPrice > 1000) {
            Swal.fire({
                icon: 'warning',
                title: 'Maximum limit for COD',
                text: 'Order above 1000 not available for COD.',
            });
            return;
        }
        fetch('/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cartData: document.getElementById('cartData').value,
                addressDetails: selectedAddressIndex,
                paymentOption: selectedPaymentMethod.value,
                discountPercentage,
                finalPrice: finalPrice,
                code
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Order Placed',
                        text: data.message,
                    }).then(() => {
                        window.location.href = '/shop';
                    });
                } else if (data.error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.error,
                        showCancelButton: true,
                        confirmButtonText: 'Go to Cart',
                        cancelButtonText: 'Cancel'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.href = '/cart';
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Unexpected Error',
                    text: 'An unexpected error occurred. Please try again later.',
                });
            });
    } else if (selectedPaymentMethod.value === 'wallet') {
        try {
            const response = await fetch('/account/wallet/check_balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ finalPrice: finalPrice })
            });
            const data = await response.json();

            if (response.ok) {
                if (data.sufficient) {
                    // Proceed with wallet payment
                    const walletResponse = await fetch('/checkout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            cartData: document.getElementById('cartData').value,
                            addressDetails: selectedAddressIndex,
                            paymentOption: selectedPaymentMethod.value,
                            discountPercentage,
                            finalPrice: finalPrice,
                            code
                        })
                    });
                    const walletData = await walletResponse.json();

                    if (walletResponse.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Order Placed',
                            text: 'Your order has been placed successfully using your wallet balance.',
                        }).then(() => {
                            window.location.href = '/shop';
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: walletData.error,
                        });
                    }
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Insufficient Wallet Balance',
                        text: 'Your wallet balance is insufficient to complete this purchase.',
                    });
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.error,
                });
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Unexpected Error',
                text: 'An unexpected error occurred. Please try again later.',
            });
        }
    }
};