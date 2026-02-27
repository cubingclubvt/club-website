//"use client";

export default function Calendar() {
    return (
        <div>
            <div className="flex flex-col gap-5 items-center max-w-4xl w-full mx-auto my-19 px-4">
                <h2 className="text-white text-5xl text-center">Calendar</h2>
                <iframe 
                src="https://calendar.google.com/calendar/embed?src=cubingclubvt%40gmail.com&ctz=America%2FNew_York"
                style={{ border: 0 }}
                className="w-full h-[500px] sm:h-[650px]" 
                frameBorder="0" 
                scrolling="no">
                </iframe>
            </div>
        </div>
    );
}
