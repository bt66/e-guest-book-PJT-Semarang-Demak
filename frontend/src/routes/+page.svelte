<script lang="ts">
	import Compressor from 'compressorjs';
	let imgSrc: string | null = null;
	let fileInput: HTMLInputElement;
	let imageFile: File | null = null;

	let nama: string = '';
	let asalInstansi: string = '';
	let keterangan: string = '';
	let submitting = false;
	let message = '';

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			message = 'Mengompres gambar...';
			submitting = true; // Disable buttons while compressing

			new Compressor(file, {
				quality: 0.8, // The compression quality (0 to 1)
				maxWidth: 1024,
				maxHeight: 1024,
				success(result: Blob) {
					// The result is a Blob, which can be used like a File.
					// To be safe and consistent, let's create a File object.
					const compressedFile = new File([result], file.name, {
						type: result.type,
						lastModified: Date.now()
					});

					if (imgSrc) {
						URL.revokeObjectURL(imgSrc);
					}
					imgSrc = URL.createObjectURL(compressedFile);
					imageFile = compressedFile;
					message = 'Kompresi berhasil!';
					submitting = false;
				},
				error(err) {
					console.error('Image compression error:', err.message);
					message = 'Gagal mengompres gambar. Menggunakan gambar asli.';
					// Fallback to original file if compression fails
					if (imgSrc) URL.revokeObjectURL(imgSrc);
					imgSrc = URL.createObjectURL(file);
					imageFile = file;
					submitting = false;
				}
			});
		}
	}

	function triggerCamera() {
		fileInput.click();
	}

	async function handleSubmit() {
		if (!nama || !asalInstansi || !keterangan || !imageFile) {
			message = 'Harap isi semua kolom dan unggah gambar.';
			return;
		}

		submitting = true;
		message = 'Mengirim data...';

		const formData = new FormData();
		formData.append('nama', nama);
		formData.append('asalInstansi', asalInstansi);
		formData.append('keterangan', keterangan);
		formData.append('foto', imageFile); // 'foto' must match multer field name on the backend

		try {
			const response = await fetch('http://localhost:3000/submit-guest', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok) {
				const responseData = result.data;
				message = `Data tamu berhasil dikirim! Ditambahkan pada ${new Date(
					responseData.dateAdded
				).toLocaleString()}`;
				resetForm();
			} else {
				throw new Error(result.error || 'Gagal mengirim data.');
			}
		} catch (error) {
			console.error('Submission error:', error);
			message = (error as Error).message;
		} finally {
			submitting = false;
		}
	}

	function resetForm() {
		nama = '';
		asalInstansi = '';
		keterangan = '';
		imageFile = null;
		if (imgSrc) URL.revokeObjectURL(imgSrc);
		imgSrc = null;
		if (fileInput) fileInput.value = '';
	}
</script>
<div class="p-3 mt-20 md:mt-25 lg:mt-30">
    <h1 class="text-center text-xl">Form Tamu Satuan Kerja Pembangunan Jalan Tol Semarang-Demak</h1>
    <form class="max-w-sm mx-auto mt-5" on:submit|preventDefault={handleSubmit}>
        <div class="mb-5 mt-10">
            <label for="nama" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nama</label>
            <input type="text" id="nama" bind:value={nama} class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="John Doe" required />
        </div>
        <div class="mb-5">
            <label for="asal-instansi" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Asal Instansi</label>
            <input type="text" id="asal-instansi" bind:value={asalInstansi} class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="PT. Sejahtera" required />
        </div>
        <div class="mb-5">
            <label for="keterangan" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Keterangan</label>
            <input type="text" id="keterangan" bind:value={keterangan} class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="Mau bertemu dengan siapa?" required />
        </div>
    
        <!-- Camera Capture Section -->
        <div class="mb-5">
            <label for="foto" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Foto</label>
            <input type="file" accept="image/*" capture="environment" on:change={handleFileSelect} bind:this={fileInput} class="hidden" id="foto" />
            <button type="button" on:click={triggerCamera} class="text-white bg-gray-700 hover:bg-gray-800 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800 mb-2">
                Ambil Gambar
            </button>
            {#if imgSrc}
                <div class="mt-4">
                    <p class="text-sm font-medium text-gray-900 dark:text-white mb-2">Hasil Gambar:</p>
                    <img src={imgSrc} alt="Hasil jepretan kamera" class="rounded-lg w-full border border-gray-300 dark:border-gray-600" />
                </div>
            {/if}
        </div>
    
        {#if message}
            <p class="mb-5 text-center text-sm" class:text-red-500={message.includes('Gagal')} class:text-green-500={message.includes('berhasil')}>{message}</p>
        {/if}
    
        <button type="submit" disabled={submitting} class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-50">
            {submitting ? message : 'Submit'}
        </button>
    </form>
</div>
