import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';

@Controller()
export class EventsStreamController {
  @EventPattern('event-stream')
  handleEventStream(@Payload() _payload: any, @Ctx() context: KafkaContext) {
    const kafkaMessage = context.getMessage();
    const key = kafkaMessage.key?.toString() ?? null;

    const messageValue = kafkaMessage.value;
    let rawValue: string | undefined;
    let parsed: unknown = messageValue;

    if (Buffer.isBuffer(messageValue)) {
      rawValue = messageValue.toString();
    } else if (typeof messageValue === 'string') {
      rawValue = messageValue;
    } else if (messageValue !== undefined) {
      rawValue = JSON.stringify(messageValue);
    }

    if (rawValue) {
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        parsed = rawValue;
      }
    }

    // eslint-disable-next-line no-console
    console.log('Real-time Event Log', {
      key,
      value: parsed,
      raw: rawValue,
      partition: context.getPartition(),
      offset: kafkaMessage.offset,
    });
  }
}
